import {
  escapeHtml,
  titleCase,
  renderStars,
  LOGO_SVG,
  PDF_BRAND,
  FONT_IMPORT,
  FONT_FAMILY,
  STARS_CSS,
} from "../../common/pdf/pdf-brand";

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

function formatMoney(amount: number, currency: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${escapeHtml(currency)} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// TODO: Unrated hotels currently default to a 4-star display rather than
// showing "Unrated" - remove this fallback once every supplier reliably
// returns a real star category.
function renderRating(rating: string): string {
  const match = rating.match(/(\d+(?:\.\d+)?)/);
  return match ? renderStars(rating) : renderStars("4 STARS");
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
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo {
    background: ${PDF_BRAND.navy};
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
    background: ${PDF_BRAND.navy};
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
    border-top: 2px solid ${PDF_BRAND.navy};
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
  ${STARS_CSS}
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
    border-top: 2px solid ${PDF_BRAND.navy};
    margin-top: 4px;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 700;
    color: ${PDF_BRAND.navy};
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
          ${LOGO_SVG}
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
