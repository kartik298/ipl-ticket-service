const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const Ticket = require('../models/Ticket');
const { verifyQRToken } = require('../generators/qrCode');
const { generateTicketPDF } = require('../generators/pdf');
const { generateQRCode } = require('../generators/qrCode');

// GET /tickets/booking/:bookingId
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ bookingId: req.params.bookingId });
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /tickets/booking/:bookingId/download — stream PDF
router.get('/booking/:bookingId/download', async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ bookingId: req.params.bookingId });
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    let pdfPath = ticket.pdfPath;

    // Generate PDF on-demand if not yet created
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await generateTicketPDF({
        bookingId:    ticket.bookingId,
        matchDetails: ticket.matchDetails,
        seats:        ticket.seats,
        totalAmount:  ticket.totalAmount,
        qrDataUrl:    ticket.qrDataUrl,
      });
      await Ticket.findByIdAndUpdate(ticket._id, { pdfPath });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ipl-ticket-${req.params.bookingId}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /tickets/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /tickets/generate — manual trigger (for testing / retries)
router.post('/generate', async (req, res) => {
  try {
    const { bookingId, userId, matchId, seats, amount, matchDetails } = req.body;
    const existing = await Ticket.findOne({ bookingId });
    if (existing) return res.json({ success: true, data: existing });

    const { qrToken, qrDataUrl } = await generateQRCode({ ticketId: bookingId, bookingId, userId, matchId, seats, matchDate: matchDetails?.matchDate });

    const ticket = await Ticket.create({ bookingId, userId, matchId, qrToken, qrDataUrl, matchDetails, seats, totalAmount: amount });

    let pdfPath = null;
    try {
      pdfPath = await generateTicketPDF({ bookingId, matchDetails, seats, totalAmount: amount, qrDataUrl });
      await Ticket.findByIdAndUpdate(ticket._id, { pdfPath });
    } catch {}

    res.status(201).json({ success: true, data: { ...ticket.toObject(), pdfPath } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /tickets/verify/:token — verify QR code
router.get('/verify/:token', (req, res) => {
  try {
    const decoded = verifyQRToken(req.params.token);
    res.json({ success: true, data: { valid: true, ...decoded } });
  } catch (err) {
    res.status(401).json({ success: false, data: { valid: false }, error: err.message });
  }
});

module.exports = router;
