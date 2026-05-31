const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const TICKETS_DIR = path.join(process.cwd(), 'tickets');

async function generateTicketPDF({ bookingId, matchDetails, seats, totalAmount, qrDataUrl, userEmail }) {
  if (!fs.existsSync(TICKETS_DIR)) fs.mkdirSync(TICKETS_DIR, { recursive: true });
  const filePath = path.join(TICKETS_DIR, `${bookingId}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'IPL Match Ticket', Author: 'IPL 2026' } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = 595, H = 841;
    const BLUE  = '#1B4F8A';
    const GOLD  = '#D4A017';
    const WHITE = '#FFFFFF';
    const DARK  = '#0A1628';
    const LIGHT = '#F5F7FA';

    // === HEADER ===
    doc.rect(0, 0, W, 120).fill(DARK);
    doc.rect(0, 115, W, 8).fill(GOLD);
    doc.font('Helvetica-Bold').fontSize(36).fillColor(GOLD).text('🏏 IPL 2026', 40, 30, { lineBreak: false });
    doc.font('Helvetica').fontSize(14).fillColor(WHITE).text('OFFICIAL MATCH TICKET', 40, 78);
    doc.font('Helvetica').fontSize(11).fillColor(GOLD).text('ADMIT ONE', W - 130, 50, { width: 100, align: 'right' });

    // === MATCH INFO ===
    const team1 = matchDetails?.team1?.shortName || 'TM1';
    const team2 = matchDetails?.team2?.shortName || 'TM2';
    const team1Name = matchDetails?.team1?.name || 'Team 1';
    const team2Name = matchDetails?.team2?.name || 'Team 2';
    const venueName = matchDetails?.venue?.name || 'Stadium';
    const venueCity = matchDetails?.venue?.city || 'City';
    const matchDate = matchDetails?.matchDate ? new Date(matchDetails.matchDate) : new Date();
    const dateStr   = matchDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr   = matchDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    doc.rect(0, 123, W, 200).fill(BLUE);

    doc.font('Helvetica-Bold').fontSize(50).fillColor(WHITE).text(team1, 50, 145, { width: 180, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(22).fillColor(GOLD).text('VS', (W - 60) / 2, 165, { width: 60, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(50).fillColor(WHITE).text(team2, W - 230, 145, { width: 180, align: 'center', lineBreak: false });

    doc.font('Helvetica').fontSize(13).fillColor(WHITE)
      .text(team1Name, 40, 210, { width: 200, align: 'center' })
      .text(team2Name, W - 240, 210, { width: 200, align: 'center' });

    doc.rect(0, 323, W, 2).fill(GOLD);

    // === DETAILS SECTION ===
    doc.rect(0, 325, W, 220).fill(LIGHT);

    const detail = (label, value, x, y, w = 240) => {
      doc.font('Helvetica').fontSize(9).fillColor('#666').text(label.toUpperCase(), x, y, { width: w });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(DARK).text(value, x, y + 14, { width: w });
    };

    detail('Date', dateStr, 40, 345);
    detail('Time', `${timeStr} IST`, 340, 345);
    detail('Venue', venueName, 40, 395);
    detail('City', venueCity, 340, 395);
    detail('Tournament', matchDetails?.tournament || 'IPL 2026', 40, 445);
    detail('Booking Reference', String(bookingId).toUpperCase().slice(-12), 340, 445);

    doc.rect(0, 545, W, 2).fill('#DDD');

    // === SEAT DETAILS ===
    doc.rect(0, 547, W, 150).fill(WHITE);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE).text('SEAT DETAILS', 40, 565);

    const seatList = Array.isArray(seats) ? seats : [];
    let seatX = 40, seatY = 590;
    seatList.forEach((seat, i) => {
      const label = `${seat.section?.replace(/_/g, ' ')} · Row ${seat.rowLabel} · Seat ${seat.seatNumber}`;
      doc.rect(seatX, seatY, 150, 36).fill(BLUE).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(WHITE).text(label, seatX + 5, seatY + 5, { width: 140 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(GOLD).text(`₹${seat.price?.toLocaleString('en-IN') || 0}`, seatX + 5, seatY + 22, { width: 140 });
      seatX += 160;
      if (seatX > W - 160) { seatX = 40; seatY += 46; }
    });

    doc.rect(0, 695, W, 3).fill(GOLD);

    // === TOTAL + QR ===
    doc.rect(0, 698, W, 100).fill(DARK);
    doc.font('Helvetica').fontSize(13).fillColor(WHITE).text('TOTAL AMOUNT PAID', 40, 720);
    doc.font('Helvetica-Bold').fontSize(28).fillColor(GOLD).text(`₹${(totalAmount || 0).toLocaleString('en-IN')}`, 40, 742);

    // QR Code from base64
    if (qrDataUrl) {
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer   = Buffer.from(base64Data, 'base64');
      doc.image(qrBuffer, W - 120, 703, { width: 90, height: 90 });
    }

    // === FOOTER ===
    doc.rect(0, H - 50, W, 50).fill('#111');
    doc.font('Helvetica').fontSize(9).fillColor('#888')
      .text('Valid photo ID required at entry  •  No re-entry allowed  •  Subject to IPL terms & conditions', 40, H - 32, { width: W - 80, align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = { generateTicketPDF };
