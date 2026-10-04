export interface HotelAllocationReportRow {
  hotelBookingId: number;
  pnr: string;
  passengerName: string;
  adults: number;
  children: number;
  travelClass: string;
  hotelName: string;
  hotelAddress: string | null;
  rating: string;
  roomsSummary: string;
  totalRooms: number;
  cost: number;
  totalCost: number;
}

export interface HotelAllocationReportInput {
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  airline: {
    name: string;
    code: string;
    address: string;
    contactEmail: string;
    contactPhone: string;
  };
  flight: {
    flightNumber: string;
    departure: string;
    arrival: string;
    cancellationDate: string;
    statusLabel: string;
  };
  rows: HotelAllocationReportRow[];
  totals: {
    totalBookings: number;
    totalRooms: number;
    subtotal: number;
    tax: number;
    platformFeePercentage: number;
    platformFee: number;
    grandTotal: number;
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(amount: number, currency: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${escapeHtml(currency)} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function renderRating(rating: string): string {
  const match = rating.match(/(\d+(?:\.\d+)?)/);
  // TODO: Unrated hotels currently default to a 4-star display rather than
  // showing "Unrated" - remove this fallback once every supplier reliably
  // returns a real star category.
  const stars = match
    ? Math.max(0, Math.min(5, Math.round(Number(match[1]))))
    : 4;
  const filled = "&#9733;".repeat(stars);
  const empty = "&#9733;".repeat(5 - stars);
  return `<span class="stars"><span class="stars-filled">${filled}</span><span class="stars-empty">${empty}</span></span>`;
}

function renderRow(row: HotelAllocationReportRow, currency: string): string {
  const paxParts = [
    row.adults > 0 ? `${row.adults} Adult${row.adults > 1 ? "s" : ""}` : null,
    row.children > 0
      ? `${row.children} Child${row.children > 1 ? "ren" : ""}`
      : null,
  ].filter(Boolean);

  return `
    <tr>
      <td class="mono">${row.hotelBookingId}</td>
      <td class="mono strong">${escapeHtml(row.pnr)}</td>
      <td>
        <div class="strong">${escapeHtml(row.passengerName)}</div>
      </td>
      <td>
        <div>${escapeHtml(paxParts.join(", ") || "-")}</div>
        <div class="muted small">${escapeHtml(titleCase(row.travelClass))}</div>
      </td>
      <td>
        <div class="strong">${escapeHtml(row.hotelName)}</div>
        ${row.hotelAddress ? `<div class="muted small">${escapeHtml(row.hotelAddress)}</div>` : ""}
      </td>
      <td class="center">${renderRating(row.rating)}</td>
      <td>
        <div>${row.totalRooms} Room${row.totalRooms !== 1 ? "s" : ""}</div>
        <div class="muted small">${escapeHtml(row.roomsSummary)}</div>
      </td>
      <td class="right mono">${formatMoney(row.cost, currency)}</td>
      <td class="right mono strong">${formatMoney(row.totalCost, currency)}</td>
    </tr>
  `;
}

export function buildHotelAllocationReportHtml(
  input: HotelAllocationReportInput,
): string {
  const { airline, flight, totals, currency } = input;
  const rowCostTotal = input.rows.reduce((sum, row) => sum + row.cost, 0);
  const rowTotalCostTotal = input.rows.reduce(
    (sum, row) => sum + row.totalCost,
    0,
  );

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap');
  * { box-sizing: border-box; }
  body {
    font-family: 'Figtree', 'Helvetica Neue', Arial, sans-serif;
    color: #1f2430;
    font-size: 11px;
    margin: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid #0F2757;
    padding-bottom: 14px;
    margin-bottom: 20px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo {
    background: #0F2757;
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
  }
  .brand-logo svg { display: block; height: 26px; width: auto; }
  .brand-sub {
    margin-top: 3px;
    font-size: 10px;
    color: #6b7280;
  }
  .invoice-title {
    text-align: right;
  }
  .invoice-title h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: 1px;
    color: #1f2430;
  }
  .invoice-meta {
    margin-top: 6px;
    font-size: 10.5px;
    color: #44485a;
  }
  .invoice-meta div { margin-top: 2px; }
  .info-grid {
    display: flex;
    justify-content: space-between;
    gap: 20px;
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
  .info-box .line.strong { font-weight: 700; font-size: 12px; }
  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }
  thead { display: table-header-group; }
  /* Without this, Chromium's print engine treats tfoot as a repeating
     footer (like thead) and reprints the totals row at the bottom of
     every page instead of once after the last data row. */
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; }
  th {
    background: #0F2757;
    color: #ffffff;
    text-align: left;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 8px 8px;
    overflow-wrap: break-word;
  }
  td {
    padding: 8px 8px;
    border-bottom: 1px solid #e5e8ee;
    vertical-align: top;
    font-size: 10.5px;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  tbody tr:nth-child(even) { background: #f9fafc; }
  tfoot .totals-row td {
    border-bottom: none;
    border-top: 2px solid #0F2757;
    background: #f6f8fb;
    font-size: 11px;
    padding: 9px 8px;
  }
  .mono { font-family: "Courier New", monospace; }
  .strong { font-weight: 700; }
  .muted { color: #6b7280; }
  .small { font-size: 9px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .stars { white-space: nowrap; }
  .stars-filled { color: #F59E0B; font-size: 11px; }
  .stars-empty { color: #E5E7EB; font-size: 11px; }
  .summary {
    display: flex;
    justify-content: flex-end;
    margin-top: 18px;
  }
  .summary-box {
    width: 260px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 11px;
    border-bottom: 1px solid #e5e8ee;
  }
  .summary-row.total {
    border-bottom: none;
    border-top: 2px solid #0F2757;
    margin-top: 4px;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #0F2757;
  }
  .footer-note {
    margin-top: 28px;
    font-size: 9.5px;
    color: #8a8f9c;
    border-top: 1px solid #e5e8ee;
    padding-top: 10px;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">
        <div class="brand-logo">
          <svg width="150" height="37" viewBox="0 0 150 37" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="3" width="31" height="31" rx="8" fill="white" fill-opacity="0.14"/>
            <g transform="translate(5.9, 8.5) scale(0.833)">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5l8 2.5z" fill="white"/>
            </g>
            <text x="40" y="26" font-family="'Figtree', 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="0.2" fill="white">FlyVoid</text>
          </svg>
        </div>
      </div>
      <div class="brand-sub">Disruption Hotel Accommodation Services</div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-meta">
        <div><strong>Invoice No:</strong> ${escapeHtml(input.invoiceNumber)}</div>
        <div><strong>Date:</strong> ${escapeHtml(input.invoiceDate)}</div>
      </div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Billed To</h3>
      <div class="line strong">${escapeHtml(airline.name)} (${escapeHtml(airline.code)})</div>
      <div class="line">${escapeHtml(airline.address)}</div>
      <div class="line">${escapeHtml(airline.contactEmail)}</div>
      <div class="line">${escapeHtml(airline.contactPhone)}</div>
    </div>
    <div class="info-box">
      <h3>Flight Details</h3>
      <div class="line strong">Flight ${escapeHtml(flight.flightNumber)}</div>
      <div class="line">${escapeHtml(flight.departure)} &rarr; ${escapeHtml(flight.arrival)}</div>
      <div class="line">Cancelled on: ${escapeHtml(flight.cancellationDate)}</div>
      <div class="line">Status: ${escapeHtml(flight.statusLabel)}</div>
    </div>
    <div class="info-box">
      <h3>Summary</h3>
      <div class="line strong">${totals.totalBookings} Booking${totals.totalBookings !== 1 ? "s" : ""}</div>
      <div class="line">${totals.totalRooms} Room${totals.totalRooms !== 1 ? "s" : ""} allocated</div>
      <div class="line">Currency: ${escapeHtml(currency)}</div>
    </div>
  </div>

  <table>
    <colgroup>
      <col style="width: 8%" />
      <col style="width: 8%" />
      <col style="width: 9%" />
      <col style="width: 10%" />
      <col style="width: 17%" />
      <col style="width: 9%" />
      <col style="width: 15.5%" />
      <col style="width: 11.5%" />
      <col style="width: 11.5%" />
    </colgroup>
    <thead>
      <tr>
        <th>Hotel Booking ID</th>
        <th>PNR</th>
        <th>Passenger</th>
        <th>Pax</th>
        <th>Hotel</th>
        <th>Rating</th>
        <th>Rooms</th>
        <th class="right">Cost</th>
        <th class="right">Total Cost</th>
      </tr>
    </thead>
    <tbody>
      ${input.rows.map((row) => renderRow(row, currency)).join("")}
    </tbody>
    <tfoot>
      <tr class="totals-row">
        <td colspan="7" class="right strong">Total</td>
        <td class="right mono strong">${formatMoney(rowCostTotal, currency)}</td>
        <td class="right mono strong">${formatMoney(rowTotalCostTotal, currency)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <div class="summary-box">
      <div class="summary-row"><span>Subtotal</span><span>${formatMoney(totals.subtotal, currency)}</span></div>
      <div class="summary-row"><span>Tax</span><span>${formatMoney(totals.tax, currency)}</span></div>
      <div class="summary-row"><span>Platform Fee (${totals.platformFeePercentage}%)</span><span>${formatMoney(totals.platformFee, currency)}</span></div>
      <div class="summary-row total"><span>Total Payable</span><span>${formatMoney(totals.grandTotal, currency)}</span></div>
    </div>
  </div>

  <div class="footer-note">
    This invoice reflects hotel accommodation arranged by FlyVoid on behalf of passengers affected by the
    cancellation of flight ${escapeHtml(flight.flightNumber)}. Amounts shown are payable by
    ${escapeHtml(airline.name)} as per the service agreement. For queries regarding this invoice, please
    contact your FlyVoid account representative.
  </div>
</body>
</html>
`;
}
