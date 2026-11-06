// Renders page 1 of the REAL hotel confirmation template (backend, read-only import) with fake
// data and a fictional hotel, as 08-confirmation-pdf.png. Run: npx tsx confirmation.mts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import QRCode from "qrcode";
import { buildHotelBookingConfirmationHtml } from "../../backend/src/hotel-bookings/templates/hotel-booking-confirmation.template";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "assets", "screenshots", "08-confirmation-pdf.png");
const REF = "BOOKING-REF-482915";

const html = buildHotelBookingConfirmationHtml({
  flyveraxConfirmationId: "5303",
  partnerOrderId: null,
  references: [{ rooms: [1], reference: REF, hotelConfirmation: null }],
  referenceQrDataUrl: await QRCode.toDataURL(REF, { margin: 0, width: 192, errorCorrectionLevel: "M" }),
  issuedDate: "Nov 26, 2026",
  airlineName: "SkyLine Airways",
  airlineSupport: null,
  guest: { names: ["Sam Sample"], email: "sam.sample@example.com", phone: "+1 555 0123", pnr: "SKY4QA", adults: 1, children: 0 },
  flight: { flightNumber: "WA0021", departure: "CDG - Paris", arrival: "JFK - New York", cancellationDate: "Nov 26, 2026" },
  hotel: {
    policies: { checkInTime: "15:00", checkOutTime: "12:00", extraInfo: null, items: [] },
    name: "Hotel Lumiere Roissy", // fictional
    rating: "4 STARS",
    address: null,
    frontDeskPhone: null,
    reservationsPhone: null,
    distanceFromAirportKm: 4.2,
    airportCode: "CDG",
  },
  stay: {
    checkInDate: "Nov 26, 2026",
    checkOutDate: "Nov 27, 2026",
    nights: 1,
    rooms: [{ roomNo: 1, roomName: "Superior Double Room", boardName: "Room only", adults: 1, children: 0, taxesAtProperty: [] }],
  },
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
await page.addStyleTag({ content: "body { padding: 34px 38px !important; }" });
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 794, height: 1123 } });
await browser.close();
console.log(`saved ${path.relative(HERE, OUT)}`);
