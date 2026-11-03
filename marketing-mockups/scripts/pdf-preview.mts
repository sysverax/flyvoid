// Renders page 1 of the real hotel confirmation template (backend, read-only import)
// with fake data, as an image for the email mock-up's attachment preview.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import QRCode from "qrcode";
import { buildHotelBookingConfirmationHtml } from "../../backend/src/hotel-bookings/templates/hotel-booking-confirmation.template";
import { DATA, SUPPLIER_BOOKING_REFERENCE } from "../config.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "build", "confirmation-preview.png");

const html = buildHotelBookingConfirmationHtml({
  flyveraxConfirmationId: "100045",
  partnerOrderId: null,
  references: [{ rooms: [1], reference: SUPPLIER_BOOKING_REFERENCE, hotelConfirmation: null }],
  referenceQrDataUrl: await QRCode.toDataURL(SUPPLIER_BOOKING_REFERENCE, {
    margin: 0,
    width: 192,
    errorCorrectionLevel: "M",
  }),
  issuedDate: "Nov 26, 2026",
  airlineName: DATA.airline_name,
  airlineSupport: null,
  guest: {
    names: [`${DATA.passenger_first_name} ${DATA.passenger_last_name}`],
    email: DATA.passenger_email,
    phone: DATA.passenger_phone,
    pnr: "SKY7Q2",
    adults: 1,
    children: 0,
  },
  flight: {
    flightNumber: DATA.flight_number,
    departure: "CDG - Paris",
    arrival: "JFK - New York",
    cancellationDate: "Nov 26, 2026",
  },
  hotel: {
    policies: { checkInTime: "15:00", checkOutTime: "12:00", extraInfo: null, items: [] },
    name: DATA.hotel_name,
    rating: "4 STARS",
    // No address: the mock-ups never show a real street address.
    address: null,
    frontDeskPhone: null,
    reservationsPhone: null,
    distanceFromAirportKm: null,
    airportCode: "CDG",
  },
  stay: {
    checkInDate: "Nov 26, 2026",
    checkOutDate: "Nov 27, 2026",
    nights: 1,
    rooms: [
      { roomNo: 1, roomName: "Classic Double Room", boardName: "Room only", adults: 1, children: 0, taxesAtProperty: [] },
    ],
  },
});

mkdirSync(path.dirname(OUT), { recursive: true });
const browser = await chromium.launch();
// A4 at 96 dpi is 794 x 1123 CSS px.
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
// The backend adds page margins through its PDF settings; mimic them here.
await page.addStyleTag({ content: "body { padding: 34px 38px !important; }" });
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 794, height: 1123 } });
await browser.close();
console.log(`PDF preview: ${path.relative(ROOT, OUT)}`);
