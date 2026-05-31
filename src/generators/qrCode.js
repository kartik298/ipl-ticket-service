const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const JWT_SECRET = process.env.JWT_SECRET || 'ipl-secret';

async function generateQRCode(ticketData) {
  const payload = {
    ticketId:  ticketData.ticketId,
    bookingId: ticketData.bookingId,
    userId:    ticketData.userId,
    matchId:   ticketData.matchId,
    seatCount: ticketData.seats ? ticketData.seats.length : 0,
    iss: 'IPL-SYSTEM',
    aud: 'IPL-GATE',
  };

  // Token valid until match date + 24 hours, or 30 days if no match date
  const matchDate = ticketData.matchDate ? new Date(ticketData.matchDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);
  const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

  const qrToken = jwt.sign(payload, JWT_SECRET, { expiresIn: Math.max(expiresIn, 3600) });

  const qrDataUrl = await QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
    color: { dark: '#1B4F8A', light: '#FFFFFF' },
  });

  return { qrToken, qrDataUrl };
}

function verifyQRToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateQRCode, verifyQRToken };
