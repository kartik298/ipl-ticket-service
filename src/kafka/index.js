const { Kafka, logLevel } = require('kafkajs');
const Ticket = require('../models/Ticket');
const { generateQRCode } = require('../generators/qrCode');
const { generateTicketPDF } = require('../generators/pdf');
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function buildKafkaConfig() {
  const cfg = {
    clientId: 'ticket-service',
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    logLevel: logLevel.WARN,
    retry: { retries: 10, initialRetryTime: 1000 },
  };
  if (process.env.KAFKA_SASL_USERNAME) {
    cfg.ssl = true;
    cfg.sasl = { mechanism: 'scram-sha-256', username: process.env.KAFKA_SASL_USERNAME, password: process.env.KAFKA_SASL_PASSWORD };
  }
  return cfg;
}

const kafka = new Kafka(buildKafkaConfig());

const producer = kafka.producer({ allowAutoTopicCreation: true });
const consumer = kafka.consumer({ groupId: 'ticket-consumer', allowAutoTopicCreation: true });

async function connectProducer() {
  await producer.connect();
  logger.info({ msg: 'Kafka producer connected (ticket-service)' });
}

async function publishEvent(topic, key, value) {
  await producer.send({ topic, messages: [{ key: String(key), value: JSON.stringify(value) }] });
}

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ['payment.completed'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        logger.info({ msg: 'Generating ticket', bookingId: data.bookingId });

        const existing = await Ticket.findOne({ bookingId: data.bookingId });
        if (existing) { logger.info({ msg: 'Ticket already exists', bookingId: data.bookingId }); return; }

        const { qrToken, qrDataUrl } = await generateQRCode({
          ticketId:  data.bookingId,
          bookingId: data.bookingId,
          userId:    data.userId,
          matchId:   data.matchId || (data.matchDetails && data.matchDetails._id),
          seats:     data.seats,
          matchDate: data.matchDetails?.matchDate,
        });

        const ticket = await Ticket.create({
          bookingId:    data.bookingId,
          userId:       data.userId,
          matchId:      data.matchId || (data.matchDetails && data.matchDetails._id),
          qrToken,
          qrDataUrl,
          matchDetails: data.matchDetails,
          seats:        data.seats,
          totalAmount:  data.amount,
        });

        let pdfPath = null;
        try {
          pdfPath = await generateTicketPDF({
            bookingId:    data.bookingId,
            matchDetails: data.matchDetails,
            seats:        data.seats,
            totalAmount:  data.amount,
            qrDataUrl,
            userEmail:    data.userEmail,
          });
          await Ticket.findByIdAndUpdate(ticket._id, { pdfPath });
        } catch (pdfErr) {
          logger.error({ msg: 'PDF generation failed', err: pdfErr.message });
        }

        await publishEvent('ticket.generated', data.bookingId, {
          ticketId:  ticket._id,
          bookingId: data.bookingId,
          userId:    data.userId,
          userEmail: data.userEmail,
          qrToken,
          pdfPath,
        });

        logger.info({ msg: 'Ticket generated', ticketId: ticket._id });
      } catch (err) {
        logger.error({ msg: 'Ticket generation error', err: err.message });
      }
    },
  });
  logger.info({ msg: 'Kafka consumer started (ticket-service)' });
}

module.exports = { connectProducer, publishEvent, startConsumer };
