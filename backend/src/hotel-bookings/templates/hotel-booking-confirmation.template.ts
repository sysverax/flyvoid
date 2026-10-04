import {
  escapeHtml,
  renderStars,
  LOGO_SVG,
  PDF_BRAND,
  FONT_IMPORT,
  FONT_FAMILY,
  STARS_CSS,
} from "../../common/pdf/pdf-brand";

export interface HotelBookingConfirmationRoom {
  roomName: string;
  boardName: string;
  adults: number;
  children: number;
}

export interface HotelBookingConfirmationInput {
  hotelBookingId: number;
  confirmationNumber: string;
  issuedDate: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    pnr: string;
    adults: number;
    children: number;
  };
  flight: {
    flightNumber: string;
    departure: string;
    arrival: string;
    cancellationDate: string;
  };
  hotel: {
    name: string;
    rating: string;
    address: string | null;
    imageUrl: string | null;
    frontDeskPhone: string | null;
    reservationsPhone: string | null;
  };
  stay: {
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalRooms: number;
    rooms: HotelBookingConfirmationRoom[];
  };
  airlineName: string;
}

function renderRoomRow(room: HotelBookingConfirmationRoom): string {
  const paxParts = [
    room.adults > 0
      ? `${room.adults} Adult${room.adults > 1 ? "s" : ""}`
      : null,
    room.children > 0
      ? `${room.children} Child${room.children > 1 ? "ren" : ""}`
      : null,
  ].filter(Boolean);

  return `
    <tr>
      <td class="strong">${escapeHtml(room.roomName)}</td>
      <td>${escapeHtml(paxParts.join(", ") || "-")}</td>
      <td>${escapeHtml(room.boardName)}</td>
    </tr>
  `;
}

export function buildHotelBookingConfirmationHtml(
  input: HotelBookingConfirmationInput,
): string {
  const { guest, flight, hotel, stay } = input;
  const guestName = `${guest.firstName} ${guest.lastName}`;

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${FONT_IMPORT}
  * { box-sizing: border-box; }
  body {
    font-family: ${FONT_FAMILY};
    color: #1f2430;
    font-size: 11px;
    margin: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid ${PDF_BRAND.navy};
    padding-bottom: 14px;
    margin-bottom: 20px;
  }
  .brand-logo {
    background: ${PDF_BRAND.navy};
    border-radius: 8px;
    padding: 10px 14px;
    display: inline-flex;
    align-items: center;
  }
  .brand-logo svg { display: block; height: 26px; width: auto; }
  .brand-sub {
    margin-top: 3px;
    font-size: 10px;
    color: #6b7280;
  }
  .doc-title {
    text-align: right;
  }
  .doc-title h1 {
    margin: 0;
    font-size: 15px;
    letter-spacing: 0.3px;
    color: #1f2430;
    white-space: nowrap;
  }
  .doc-title .sub {
    font-size: 10.5px;
    color: #6b7280;
    margin-top: 2px;
  }
  .doc-meta {
    margin-top: 8px;
    font-size: 10.5px;
    color: #44485a;
  }
  .doc-meta div { margin-top: 2px; }
  .prepaid-banner {
    background: ${PDF_BRAND.greenBg};
    border: 1px solid ${PDF_BRAND.greenBorder};
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .prepaid-banner .check {
    color: ${PDF_BRAND.green};
    font-size: 18px;
    line-height: 1;
    font-weight: 700;
  }
  .prepaid-banner .title {
    color: ${PDF_BRAND.green};
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.3px;
  }
  .prepaid-banner .desc {
    margin-top: 3px;
    font-size: 10.5px;
    color: #1f2430;
    line-height: 1.5;
  }
  .hotel-image {
    width: 100%;
    max-height: 170px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 20px;
    display: block;
  }
  .info-grid {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }
  .info-box {
    flex: 1;
    background: #f6f8fb;
    border-radius: 6px;
    padding: 12px 14px;
  }
  .info-box h3 {
    margin: 0 0 6px 0;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
  }
  .info-box .line { font-size: 11px; margin-top: 2px; }
  .info-box .line.strong { font-weight: 700; font-size: 12.5px; }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: ${PDF_BRAND.navy};
    margin: 22px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    background: ${PDF_BRAND.navy};
    color: #ffffff;
    text-align: left;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 8px 10px;
  }
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #e5e8ee;
    font-size: 10.5px;
  }
  tbody tr:nth-child(even) { background: #f9fafc; }
  .strong { font-weight: 700; }
  .muted { color: #6b7280; }
  ${STARS_CSS}
  .footer-note {
    margin-top: 32px;
    font-size: 9.5px;
    color: #8a8f9c;
    border-top: 1px solid #e5e8ee;
    padding-top: 12px;
    line-height: 1.6;
  }
  .ref-strip {
    margin-top: 22px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #6b7280;
    border-top: 1px dashed #d8dde6;
    padding-top: 10px;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-logo">
        ${LOGO_SVG}
      </div>
      <div class="brand-sub">Disruption Hotel Accommodation Services</div>
    </div>
    <div class="doc-title">
      <h1>HOTEL BOOKING CONFIRMATION</h1>
      <div class="sub">Accommodation Voucher - Present at Check-in</div>
      <div class="doc-meta">
        <div><strong>Confirmation No:</strong> ${escapeHtml(input.confirmationNumber)}</div>
        <div><strong>Issued:</strong> ${escapeHtml(input.issuedDate)}</div>
      </div>
    </div>
  </div>

  <div class="prepaid-banner">
    <div class="check">&#10003;</div>
    <div>
      <div class="title">FULLY PREPAID &ndash; NO PAYMENT REQUIRED AT CHECK-IN</div>
      <div class="desc">
        This accommodation has been paid in full by ${escapeHtml(input.airlineName)} on behalf of the
        guest named below, following the cancellation of flight ${escapeHtml(flight.flightNumber)}.
        No further payment is due from the guest for the room stay. Please present this confirmation at check-in.
      </div>
    </div>
  </div>

  ${
    hotel.imageUrl
      ? `<img class="hotel-image" src="${escapeHtml(hotel.imageUrl)}" alt="${escapeHtml(hotel.name)}" onerror="this.style.display='none'" />`
      : ""
  }

  <div class="info-grid">
    <div class="info-box">
      <h3>Guest</h3>
      <div class="line strong">${escapeHtml(guestName)}</div>
      <div class="line">PNR: ${escapeHtml(guest.pnr)}</div>
      <div class="line">${escapeHtml(guest.email)}</div>
      <div class="line">${escapeHtml(guest.phone)}</div>
      <div class="line">${guest.adults} Adult${guest.adults !== 1 ? "s" : ""}, ${guest.children} Child${guest.children !== 1 ? "ren" : ""}</div>
    </div>
    <div class="info-box">
      <h3>Hotel</h3>
      <div class="line strong">${escapeHtml(hotel.name)}</div>
      <div class="line">${renderStars(hotel.rating)}</div>
      ${hotel.address ? `<div class="line">${escapeHtml(hotel.address)}</div>` : ""}
      ${hotel.frontDeskPhone ? `<div class="line"><span class="muted">Front Desk:</span> ${escapeHtml(hotel.frontDeskPhone)}</div>` : ""}
      ${hotel.reservationsPhone ? `<div class="line"><span class="muted">Reservations:</span> ${escapeHtml(hotel.reservationsPhone)}</div>` : ""}
    </div>
    <div class="info-box">
      <h3>Stay</h3>
      <div class="line"><span class="muted">Check-in:</span> <span class="strong">${escapeHtml(stay.checkInDate)}</span></div>
      <div class="line"><span class="muted">Check-out:</span> <span class="strong">${escapeHtml(stay.checkOutDate)}</span></div>
      <div class="line">${stay.nights} Night${stay.nights !== 1 ? "s" : ""}, ${stay.totalRooms} Room${stay.totalRooms !== 1 ? "s" : ""}</div>
    </div>
  </div>

  <div class="section-title">Room Details</div>
  <table>
    <thead>
      <tr>
        <th>Room Type</th>
        <th>Occupancy</th>
        <th>Board / Meal Plan</th>
      </tr>
    </thead>
    <tbody>
      ${stay.rooms.map((room) => renderRoomRow(room)).join("")}
    </tbody>
  </table>

  <div class="ref-strip">
    <div>Flight ${escapeHtml(flight.flightNumber)}: ${escapeHtml(flight.departure)} &rarr; ${escapeHtml(flight.arrival)}</div>
    <div>Cancelled on ${escapeHtml(flight.cancellationDate)}</div>
    <div>Hotel Booking ID: ${input.hotelBookingId}</div>
  </div>

  <div class="footer-note">
    This accommodation was arranged by FlyVoid on behalf of ${escapeHtml(input.airlineName)} for passengers
    affected by the cancellation of flight ${escapeHtml(flight.flightNumber)}. If you have any questions about
    this booking, please contact ${escapeHtml(input.airlineName)} directly, or ask hotel reception to verify
    this confirmation using the booking reference above.
  </div>
</body>
</html>
`;
}
