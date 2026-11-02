import {
  escapeHtml,
  renderStars,
  LOGO_SVG,
  FONT_IMPORT,
  FONT_FAMILY,
  STARS_CSS,
} from "../../common/pdf/pdf-brand";
import {
  HotelPolicies,
  TaxAtProperty,
} from "../../cancelled-flights/hotel-providers/hotel-provider.interface";
import { SupplierReferenceGroup } from "../supplier-references";

// Flyverax product palette (frontend design tokens).
const COLORS = {
  navy: "#0F2757",
  infoBg: "#F3F4F6",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  amberBg: "#FFFBEB",
  amberBorder: "#FDE68A",
};

export interface HotelBookingConfirmationRoom {
  roomNo: number;
  roomName: string;
  boardName: string;
  adults: number;
  children: number;
  taxesAtProperty: TaxAtProperty[];
}

export interface HotelBookingConfirmationInput {
  /** Our hotel booking id, printed small for support use only. */
  flyveraxConfirmationId: string;
  /** Our own order id sent to the supplier (RateHawk partner_order_id), support use only. */
  partnerOrderId: string | null;
  /** Supplier references exactly as issued (at least one; checked by the caller). */
  references: SupplierReferenceGroup[];
  /** QR code image (data URL) of the supplier reference; shown only when there is one reference. */
  referenceQrDataUrl: string | null;
  issuedDate: string;
  airlineName: string;
  /**
   * Passenger-facing airline help contact. No such field is stored yet
   * (airlines.contact_email / contact_phone are the onboarding company
   * contact), so callers pass null and the "Need help?" section is omitted.
   * TODO(airline-support-contact): pass the airline's support contact once stored.
   */
  airlineSupport: { phone: string | null; email: string | null } | null;
  guest: {
    /** Every guest name stored for the booking (today only the lead passenger). */
    names: string[];
    email: string | null;
    phone: string | null;
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
    policies: HotelPolicies | null;
    name: string;
    rating: string;
    address: string | null;
    frontDeskPhone: string | null;
    reservationsPhone: string | null;
    distanceFromAirportKm: number | null;
    /** IATA code of the airport the distance is measured from. */
    airportCode: string | null;
  };
  stay: {
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    rooms: HotelBookingConfirmationRoom[];
  };
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** "2 Adults, 1 Child". Children's ages are never shown (they are not reliably stored). */
const paxLabel = (adults: number, children: number) =>
  [
    adults > 0 ? plural(adults, "Adult", "Adults") : null,
    children > 0 ? plural(children, "Child", "Children") : null,
  ]
    .filter(Boolean)
    .join(", ") || "-";

const ROOM_ONLY = /\b(room only|no meals?|nomeal|without meals?)\b/i;
const isRoomOnly = (board: string) => !board.trim() || ROOM_ONLY.test(board);

/** Local taxes payable at the hotel, totalled per currency across all rooms. */
function taxTotals(rooms: HotelBookingConfirmationRoom[]) {
  const totals = new Map<string, number>();
  for (const room of rooms) {
    for (const tax of room.taxesAtProperty) {
      if (!Number.isFinite(tax.amount) || tax.amount <= 0) continue;
      const currency = (tax.currencyCode ?? "").trim();
      totals.set(currency, (totals.get(currency) ?? 0) + tax.amount);
    }
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
}

const money = (amount: number, currency: string) =>
  `${amount.toFixed(2)}${currency ? ` ${currency}` : ""}`;

/** Deposit rules as the hotel states them (policy items whose category mentions a deposit). */
function depositLines(policies: HotelPolicies | null): string[] {
  return (policies?.items ?? [])
    .filter((item) => /deposit/i.test(item.category))
    .flatMap((item) => item.details)
    .filter((detail) => detail.trim().length > 0);
}

/** What the hotel says guests must present, found in its policy text. */
function presentRequirements(policies: HotelPolicies | null): string[] {
  const textBlob = [
    policies?.extraInfo ?? "",
    ...(policies?.items ?? []).flatMap((item) => item.details),
  ].join(" \n ");
  const found: string[] = [];
  if (/photo\s*id|photo identification|government[- ]issued id|valid id|identity (card|document)|passport/i.test(textBlob)) {
    found.push("photo ID");
  }
  if (/credit\s*card/i.test(textBlob)) {
    found.push("a credit card");
  }
  return found;
}

function renderReferences(input: HotelBookingConfirmationInput): string {
  const groups = input.references;
  const single = groups.length === 1;
  const rows = groups
    .map((group) => {
      const roomsLabel = single
        ? ""
        : `<span class="ref-rooms">Room${group.rooms.length > 1 ? "s" : ""} ${group.rooms.join(", ")}</span>`;
      const hotelConf = group.hotelConfirmation
        ? `<div class="ref-hotel"><span class="ref-label">Hotel confirmation no.</span> <span class="ref-hotel-value">${escapeHtml(group.hotelConfirmation)}</span></div>`
        : "";
      return `<div class="ref-row">${roomsLabel}<div class="ref-value">${escapeHtml(group.reference)}</div>${hotelConf}</div>`;
    })
    .join("");
  // A QR code only for a single reference, so it never encodes just one room's.
  const qr =
    single && input.referenceQrDataUrl
      ? `<img class="ref-qr" src="${input.referenceQrDataUrl}" alt="Booking reference QR code" />`
      : "";
  return `
  <div class="ref-box avoid-break">
    <div class="ref-main">
      <div class="ref-title">Booking reference &ndash; show this at check-in</div>
      ${rows}
    </div>
    ${qr}
  </div>`;
}

function renderPayOrShow(input: HotelBookingConfirmationInput): string {
  const totals = taxTotals(input.stay.rooms);
  const deposits = depositLines(input.hotel.policies);
  const present = presentRequirements(input.hotel.policies);
  if (totals.length === 0 && deposits.length === 0 && present.length === 0) {
    return "";
  }
  const taxRooms = input.stay.rooms.filter((room) =>
    room.taxesAtProperty.some((tax) => Number.isFinite(tax.amount) && tax.amount > 0),
  );
  const taxDetail =
    taxRooms.length > 1
      ? `<div class="pay-detail">${taxRooms
          .map(
            (room) =>
              `Room ${room.roomNo}: ${room.taxesAtProperty
                .filter((tax) => Number.isFinite(tax.amount) && tax.amount > 0)
                .map((tax) => `${escapeHtml(tax.name)} ${escapeHtml(money(tax.amount, (tax.currencyCode ?? "").trim()))}`)
                .join(", ")}`,
          )
          .join(" &middot; ")}</div>`
      : taxRooms.length === 1
        ? `<div class="pay-detail">${taxRooms[0].taxesAtProperty
            .filter((tax) => Number.isFinite(tax.amount) && tax.amount > 0)
            .map((tax) => escapeHtml(tax.name))
            .join(", ")}</div>`
        : "";
  const items: string[] = [];
  if (totals.length > 0) {
    items.push(`
      <li>
        <span class="strong">Local taxes, paid by the guest at the hotel: ${totals
          .map((total) => escapeHtml(money(total.amount, total.currency)))
          .join(" + ")} in total</span>
        ${taxDetail}
      </li>`);
  }
  for (const deposit of deposits) {
    items.push(`<li><span class="strong">Deposit:</span> ${escapeHtml(deposit)}</li>`);
  }
  if (present.length > 0) {
    items.push(
      `<li><span class="strong">Please present ${present.join(" and ")}</span> at check-in.</li>`,
    );
  }
  return `
  <div class="pay-box avoid-break">
    <div class="pay-title">What you may need to pay or show at the hotel</div>
    <ul class="pay-list">${items.join("")}</ul>
  </div>`;
}

function renderPolicies(policies: HotelPolicies | null): string {
  if (!policies) return "";
  const times = [
    policies.checkInTime ? `Check-in from <span class="strong">${escapeHtml(policies.checkInTime)}</span>` : null,
    policies.checkOutTime ? `Check-out by <span class="strong">${escapeHtml(policies.checkOutTime)}</span>` : null,
  ].filter(Boolean);
  // Deposits are listed in the pay-or-show box above.
  const items = policies.items.filter((item) => !/deposit/i.test(item.category));
  if (times.length === 0 && !policies.extraInfo && items.length === 0) return "";
  return `
  <div class="section avoid-break">
    <div class="section-title">Hotel policies</div>
    <div class="policies">
      ${times.length ? `<div class="policy-line">${times.join(" &middot; ")}</div>` : ""}
      ${policies.extraInfo ? `<div class="policy-extra">${escapeHtml(policies.extraInfo)}</div>` : ""}
      ${items
        .map(
          (item) => `<div class="policy-item"><span class="strong">${escapeHtml(item.category)}:</span> ${item.details
            .map((detail) => escapeHtml(detail))
            .join(" &middot; ")}</div>`,
        )
        .join("")}
    </div>
  </div>`;
}

function renderRooms(input: HotelBookingConfirmationInput): string {
  // Reference per room only when the rooms have different references.
  const perRoomRef = input.references.length > 1;
  const refOf = (roomNo: number) =>
    input.references.find((group) => group.rooms.includes(roomNo))?.reference ?? "-";
  const rows = input.stay.rooms
    .map(
      (room) => `
    <tr>
      <td class="nowrap">Room ${room.roomNo}</td>
      <td class="strong wrap">${escapeHtml(room.roomName)}</td>
      <td>${escapeHtml(paxLabel(room.adults, room.children))}</td>
      <td class="wrap">${escapeHtml(room.boardName || "Room only")}</td>
      ${perRoomRef ? `<td class="wrap mono">${escapeHtml(refOf(room.roomNo))}</td>` : ""}
    </tr>`,
    )
    .join("");
  return `
  <div class="section">
    <div class="section-title">Rooms</div>
    <table>
      <thead>
        <tr>
          <th style="width: 12%">Room</th>
          <th>Room type</th>
          <th style="width: 18%">Guests</th>
          <th style="width: 24%">Meal plan</th>
          ${perRoomRef ? `<th style="width: 20%">Booking reference</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderGoodToKnow(input: HotelBookingConfirmationInput): string {
  const rooms = input.stay.rooms;
  const allRoomOnly = rooms.every((room) => isRoomOnly(room.boardName));
  const lines = [
    allRoomOnly
      ? "Meals are not included. The guest pays for any meals at the hotel."
      : "Meals: as listed per room above. Other meals are not included.",
    // Flyverax books rooms only; transfers are never part of the booking.
    "Airport transfers are not included.",
    `If your flight is rebooked and you no longer need this room, please contact ${escapeHtml(input.airlineName)} as soon as possible.`,
  ];
  return `
  <div class="section avoid-break">
    <div class="section-title">Good to know</div>
    <ul class="know-list">${lines.map((line) => `<li>${line}</li>`).join("")}</ul>
  </div>`;
}

function renderHelp(input: HotelBookingConfirmationInput): string {
  const support = input.airlineSupport;
  if (!support || (!support.phone && !support.email)) return "";
  const parts = [
    support.phone ? `Phone: <span class="strong">${escapeHtml(support.phone)}</span>` : null,
    support.email ? `Email: <span class="strong">${escapeHtml(support.email)}</span>` : null,
  ].filter(Boolean);
  return `
  <div class="help-box avoid-break">
    <span class="strong">Need help?</span> Contact ${escapeHtml(input.airlineName)} &middot; ${parts.join(" &middot; ")}
  </div>`;
}

export function buildHotelBookingConfirmationHtml(
  input: HotelBookingConfirmationInput,
): string {
  const { guest, flight, hotel, stay } = input;
  const allRoomOnly = stay.rooms.every((room) => isRoomOnly(room.boardName));
  const prepaid = allRoomOnly
    ? `Room prepaid by ${escapeHtml(input.airlineName)}`
    : `Room and meals prepaid by ${escapeHtml(input.airlineName)}`;
  const names = guest.names.filter((name) => name.trim().length > 0);
  const distance =
    hotel.distanceFromAirportKm != null && Number.isFinite(hotel.distanceFromAirportKm)
      ? `${hotel.distanceFromAirportKm.toFixed(1)} km from ${hotel.airportCode ? `${escapeHtml(hotel.airportCode)} airport` : "the airport"}`
      : null;
  const phones = [
    hotel.frontDeskPhone ? `Front desk: <span class="strong">${escapeHtml(hotel.frontDeskPhone)}</span>` : null,
    hotel.reservationsPhone ? `Reservations: <span class="strong">${escapeHtml(hotel.reservationsPhone)}</span>` : null,
  ].filter(Boolean);
  const contactLine = [
    guest.email ? escapeHtml(guest.email) : null,
    guest.phone ? escapeHtml(guest.phone) : null,
  ].filter(Boolean);
  const totalRooms = stay.rooms.length;

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
    color: ${COLORS.text};
    font-size: 10.5px;
    line-height: 1.45;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .strong { font-weight: 600; color: ${COLORS.text}; }
  .muted { color: ${COLORS.muted}; }
  .small { font-size: 9px; }
  .nowrap { white-space: nowrap; }
  .wrap { overflow-wrap: anywhere; word-break: break-word; }
  .mono { font-variant-numeric: tabular-nums; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 10px;
    border-bottom: 3px solid ${COLORS.navy};
  }
  .brand-logo {
    display: inline-flex;
    background: ${COLORS.navy};
    border-radius: 8px;
    padding: 6px 12px 6px 8px;
  }
  .brand-sub { margin-top: 5px; font-size: 9.5px; color: ${COLORS.muted}; }
  .doc-title { text-align: right; }
  .doc-title h1 { margin: 2px 0 2px; font-size: 16px; font-weight: 700; color: ${COLORS.navy}; letter-spacing: 0.3px; }
  .doc-title .muted { font-size: 9.5px; }

  .ref-box {
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    border: 2px solid ${COLORS.navy};
    border-radius: 8px;
    padding: 10px 14px;
  }
  .ref-main { min-width: 0; flex: 1; }
  .ref-title { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: ${COLORS.navy}; }
  .ref-row { margin-top: 4px; }
  .ref-rooms { font-size: 9.5px; color: ${COLORS.muted}; margin-right: 6px; }
  .ref-value { display: inline; font-size: 18px; font-weight: 700; color: ${COLORS.text}; letter-spacing: 0.4px; overflow-wrap: anywhere; }
  .ref-hotel { margin-top: 2px; font-size: 10.5px; }
  .ref-label { color: ${COLORS.muted}; }
  .ref-hotel-value { font-weight: 600; }
  .ref-qr { width: 64px; height: 64px; flex-shrink: 0; }

  .prepaid {
    margin-top: 10px;
    background: ${COLORS.navy};
    color: white;
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 11.5px;
    font-weight: 600;
  }
  .prepaid-sub { font-weight: 400; font-size: 9.5px; opacity: 0.85; margin-left: 6px; }

  .grid { display: flex; gap: 10px; margin-top: 10px; }
  .card { flex: 1; min-width: 0; background: ${COLORS.infoBg}; border-radius: 8px; padding: 9px 12px; }
  .card-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: ${COLORS.muted}; margin-bottom: 3px; }
  .big { font-size: 14px; font-weight: 700; color: ${COLORS.text}; }
  .date-row { display: flex; gap: 14px; }
  .date-row > div { min-width: 0; }
  .hotel-name { font-size: 15px; font-weight: 700; color: ${COLORS.text}; }
  .hotel-address { font-size: 12px; margin-top: 2px; }

  .section { margin-top: 12px; }
  .section-title {
    font-size: 10.5px;
    font-weight: 700;
    color: ${COLORS.navy};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 5px;
  }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th {
    background: ${COLORS.navy};
    color: white;
    text-align: left;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 6px 8px;
  }
  td { padding: 6px 8px; border-bottom: 1px solid ${COLORS.border}; vertical-align: top; }

  .pay-box {
    margin-top: 12px;
    background: ${COLORS.amberBg};
    border: 1px solid ${COLORS.amberBorder};
    border-radius: 8px;
    padding: 9px 12px;
  }
  .pay-title { font-size: 10.5px; font-weight: 700; color: ${COLORS.navy}; text-transform: uppercase; letter-spacing: 0.5px; }
  .pay-list { margin: 5px 0 0; padding-left: 16px; }
  .pay-list li { margin-top: 2px; }
  .pay-detail { color: ${COLORS.muted}; font-size: 9.5px; }

  .policies { background: ${COLORS.infoBg}; border-radius: 8px; padding: 8px 12px; }
  .policy-line { margin-bottom: 3px; }
  .policy-extra { white-space: pre-line; margin-bottom: 3px; }
  .policy-item { margin-top: 2px; }

  .know-list { margin: 0; padding-left: 16px; }
  .know-list li { margin-top: 1px; }

  .help-box { margin-top: 12px; background: ${COLORS.infoBg}; border-radius: 8px; padding: 8px 12px; }

  .footer {
    margin-top: 14px;
    border-top: 1px solid ${COLORS.border};
    padding-top: 8px;
    font-size: 9px;
    color: ${COLORS.muted};
    line-height: 1.5;
  }
  .footer-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px; }
  ${STARS_CSS}
</style>
</head>
<body>
  <div class="header avoid-break">
    <div>
      <div class="brand-logo">${LOGO_SVG}</div>
      <div class="brand-sub">Disruption Hotel Accommodation Services</div>
    </div>
    <div class="doc-title">
      <h1>HOTEL BOOKING CONFIRMATION</h1>
      <div class="muted">Accommodation voucher &middot; present at check-in</div>
      <div class="muted">Issued ${escapeHtml(input.issuedDate)}</div>
    </div>
  </div>

  ${renderReferences(input)}

  <div class="prepaid avoid-break">
    &#10003; ${prepaid}<span class="prepaid-sub">following the cancellation of flight ${escapeHtml(flight.flightNumber)}</span>
  </div>

  <div class="grid avoid-break">
    <div class="card">
      <div class="card-label">${names.length > 1 ? "Guests" : "Guest"}</div>
      <div class="big">${names.length ? names.map((name) => escapeHtml(name)).join("<br/>") : "-"}</div>
      <div>PNR: <span class="strong">${escapeHtml(guest.pnr)}</span> &middot; ${escapeHtml(paxLabel(guest.adults, guest.children))}</div>
      ${contactLine.length ? `<div class="muted">${contactLine.join(" &middot; ")}</div>` : ""}
    </div>
    <div class="card">
      <div class="card-label">Stay</div>
      <div class="date-row">
        <div><div class="muted">Check-in</div><div class="big">${escapeHtml(stay.checkInDate)}</div></div>
        <div><div class="muted">Check-out</div><div class="big">${escapeHtml(stay.checkOutDate)}</div></div>
      </div>
      <div>${plural(stay.nights, "night", "nights")} &middot; ${plural(totalRooms, "room", "rooms")}</div>
    </div>
  </div>

  <div class="grid avoid-break">
    <div class="card">
      <div class="card-label">Hotel</div>
      <div class="hotel-name">${escapeHtml(hotel.name)}</div>
      <div>${renderStars(hotel.rating)}</div>
      ${hotel.address ? `<div class="hotel-address">${escapeHtml(hotel.address)}</div>` : ""}
      ${distance ? `<div class="muted">${distance}</div>` : ""}
      ${phones.length ? `<div>${phones.join(" &middot; ")}</div>` : ""}
    </div>
  </div>

  ${renderRooms(input)}
  ${renderPayOrShow(input)}
  ${renderPolicies(hotel.policies)}
  ${renderGoodToKnow(input)}
  ${renderHelp(input)}

  <div class="footer avoid-break">
    <div>
      This accommodation was arranged by Flyverax on behalf of ${escapeHtml(input.airlineName)} for passengers affected by the
      cancellation of flight ${escapeHtml(flight.flightNumber)} (${escapeHtml(flight.departure)} &rarr; ${escapeHtml(flight.arrival)},
      cancelled on ${escapeHtml(flight.cancellationDate)}). Hotel reception can verify this booking with the booking reference above.
    </div>
    <div class="footer-meta">
      <span>Flyverax confirmation ID: ${escapeHtml(input.flyveraxConfirmationId)}</span>
      ${input.partnerOrderId ? `<span>Partner order ID: ${escapeHtml(input.partnerOrderId)}</span>` : ""}
      <span>For support use only</span>
    </div>
  </div>
</body>
</html>`;
}
