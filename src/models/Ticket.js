const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  bookingId:  { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  matchId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  qrToken:    { type: String, required: true },
  qrDataUrl:  { type: String },
  pdfPath:    { type: String },
  status:     { type: String, enum: ['valid', 'used', 'cancelled'], default: 'valid' },
  matchDetails: { type: mongoose.Schema.Types.Mixed },
  seats:        { type: mongoose.Schema.Types.Mixed },
  totalAmount:  { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
