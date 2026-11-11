// Fake API fixtures for the Flyverax airline portal marketing screenshots.
// Everything here is fictional: "SkyLine Airways", placeholder passenger
// names, @example.com emails, +1 555 01xx phones, invented hotel names and
// placeholder supplier references. Response shapes follow
// frontend/airline/src/services/*.ts.

export const NOW = "2026-11-26T10:30:00+01:00"; // Europe/Paris
export const TIMEZONE = "Europe/Paris";

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (arr, f = (x) => x) => round2(arr.reduce((s, x) => s + f(x), 0));

// ---------------------------------------------------------------------------
// Session user / airline
// ---------------------------------------------------------------------------
export const AIRLINE = { id: 7, name: "SkyLine Airways", code: "WA" };

export const SESSION_USER = {
  id: 41,
  email: "jordan.sample@example.com",
  role: "AIRLINE_ADMIN",
  firstName: "Jordan",
  lastName: "Sample",
  accessControls: [],
};

const userProfile = {
  id: SESSION_USER.id,
  airlineId: AIRLINE.id,
  firstName: SESSION_USER.firstName,
  lastName: SESSION_USER.lastName,
  email: SESSION_USER.email,
  role: SESSION_USER.role,
};

const airlineProfile = {
  id: AIRLINE.id,
  name: AIRLINE.name,
  code: AIRLINE.code,
  countryCode: "FR",
  contactEmail: "ops@example.com",
  contactPhone: "+1 555 0100",
};

// ---------------------------------------------------------------------------
// Airports (real IATA codes)
// ---------------------------------------------------------------------------
const AIRPORTS = [
  { id: 1, iataCode: "CDG", name: "Paris Charles de Gaulle Airport" },
  { id: 2, iataCode: "JFK", name: "John F. Kennedy International Airport" },
  { id: 3, iataCode: "BOS", name: "Boston Logan International Airport" },
  { id: 4, iataCode: "YUL", name: "Montreal-Trudeau International Airport" },
  { id: 5, iataCode: "AMS", name: "Amsterdam Airport Schiphol" },
  { id: 6, iataCode: "ORD", name: "Chicago O'Hare International Airport" },
  { id: 7, iataCode: "FRA", name: "Frankfurt Airport" },
  { id: 8, iataCode: "IAD", name: "Washington Dulles International Airport" },
  { id: 9, iataCode: "MIA", name: "Miami International Airport" },
  { id: 10, iataCode: "MAD", name: "Madrid-Barajas Airport" },
  { id: 11, iataCode: "EWR", name: "Newark Liberty International Airport" },
  { id: 12, iataCode: "LIS", name: "Lisbon Humberto Delgado Airport" },
];
const airport = (code) => {
  const a = AIRPORTS.find((x) => x.iataCode === code);
  return { id: a.id, code: a.iataCode, name: a.name };
};

// ---------------------------------------------------------------------------
// Passengers (obviously generic placeholder names)
// ---------------------------------------------------------------------------
const NAMES = [
  ["Jane", "Doe"], ["John", "Doe"], ["Joe", "Bloggs"], ["Max", "Mustermann"],
  ["Erika", "Mustermann"], ["Jean", "Dupont"], ["Marie", "Dupont"], ["Mario", "Rossi"],
  ["Juan", "Perez"], ["Alex", "Example"], ["Sam", "Sample"], ["Chris", "Demo"],
  ["Pat", "Placeholder"], ["Taylor", "Testwell"], ["Jordan", "Mock"], ["Casey", "Fiction"],
  ["Robin", "Sampleford"], ["Dana", "Exampleton"], ["Fred", "Nurk"], ["Kim", "Placeholder"],
  ["Lee", "Demoson"], ["Jamie", "Specimen"], ["Morgan", "Testa"], ["Riley", "Dummy"],
];
const PNR_SUFFIXES = [
  "7Q2", "4M8", "9KD", "2XR", "6PB", "3LW", "8TN", "5HC", "1VZ", "7JF", "4QA", "2MS",
  "9RE", "6DK", "3BX", "8WP", "5NL", "1GT", "7CY", "4HV", "2ZF", "9PM", "6TQ", "3KR",
];
const RESIDENCY = ["FR", "US", "GB", "DE", "FR", "US", "CA", "IT", "ES", "US", "FR", "NL"];
// adults, children, class
const PARTIES = [
  [2, 0, "economy"], [1, 0, "business"], [2, 1, "economy"], [3, 0, "economy"],
  [1, 0, "economy"], [2, 2, "premium_economy"], [2, 0, "business"], [1, 0, "economy"],
  [2, 0, "economy"], [4, 1, "economy"], [1, 0, "first_class"], [2, 1, "economy"],
  [2, 0, "premium_economy"], [1, 0, "economy"], [3, 1, "economy"], [2, 0, "economy"],
  [1, 0, "business"], [2, 0, "economy"], [2, 1, "economy"], [1, 0, "economy"],
  [2, 0, "business"], [3, 0, "economy"],
];
const NOTES = ["", "", "Wheelchair Assistance", "", "", "Dietary Requirements", "", "", "", "Traveling with infant", "", ""];

function makePassengers(flightId, count, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const k = (i + offset) % NAMES.length;
    const [firstName, lastName] = NAMES[k];
    const [adults, children, travelClass] = PARTIES[(i + offset) % PARTIES.length];
    const childAges = Array.from({ length: children }, (_, c) => [7, 4, 10][c % 3]);
    return {
      id: flightId * 100 + i + 1,
      cancelledFlightId: flightId,
      pnr: `SKY${PNR_SUFFIXES[(i + offset) % PNR_SUFFIXES.length]}`,
      firstName,
      lastName,
      email: `${firstName}.${lastName}`.toLowerCase() + "@example.com",
      phone: `+1 555 01${String(10 + ((i + offset) % 89)).padStart(2, "0")}`,
      residency: RESIDENCY[(i + offset) % RESIDENCY.length],
      travelClass,
      adults,
      children,
      childAges,
      specialNotes: NOTES[(i + offset) % NOTES.length] || null,
      createdAt: "2026-11-26T08:14:00.000Z",
      updatedAt: "2026-11-26T08:14:00.000Z",
    };
  });
}

// ---------------------------------------------------------------------------
// Hotels (fictional names only, no real addresses)
// ---------------------------------------------------------------------------
const HOTELS = {
  lumiere: { hotelCode: "HTL-1001", hotelName: "Hotel Lumiere Roissy", category: "4", stars: 4 },
  aeropark: { hotelCode: "HTL-1002", hotelName: "Aeropark Suites", category: "4", stars: 4 },
  northgate: { hotelCode: "HTL-1003", hotelName: "Northgate Airport Inn", category: "3", stars: 3 },
  ailes: { hotelCode: "HTL-1004", hotelName: "Residence Les Ailes", category: "3", stars: 3 },
};
const hotelFor = (travelClass, i) =>
  travelClass === "business" || travelClass === "first_class"
    ? HOTELS.lumiere
    : travelClass === "premium_economy"
      ? HOTELS.aeropark
      : i % 2 === 0
        ? HOTELS.northgate
        : HOTELS.ailes;
const NIGHTLY = { "HTL-1001": 212, "HTL-1002": 176, "HTL-1003": 138, "HTL-1004": 129 };

/** Per-booking money: hotel cost, 5% platform discount, 8% hotel tax, 10% fee. */
function priceBooking(p, i) {
  const hotel = hotelFor(p.travelClass, i);
  const rooms = Math.max(1, Math.ceil(p.adults / 2));
  const cost = round2(rooms * NIGHTLY[hotel.hotelCode] + (i % 3) * 4.5);
  const discount = round2(cost * 0.05);
  const tax = round2(cost * 0.08);
  const fee = round2((cost - discount) * 0.1);
  const total = round2(cost - discount + tax + fee);
  return { hotel, rooms, cost, discount, tax, fee, total };
}

const supplierRef = (n) => `BOOKING-REF-${String(123456 + n * 7919).slice(-6)}`;

// ---------------------------------------------------------------------------
// Flights
// ---------------------------------------------------------------------------
// 1025 draft (screen 03), 1024 importing (screen 04), 1023 allocation
// (screen 05), 1021 allocated (screen 06).
const PAX = {
  1024: makePassengers(1024, 20, 3),
  1023: makePassengers(1023, 18, 0),
  1022: makePassengers(1022, 22, 5),
  1021: makePassengers(1021, 10, 8),
};

// Allocation results for 1023 (WA0021): 17 booked, 1 failed. No manual check: it confuses landing-page visitors.
const ALLOC_1023 = PAX[1023].map((p, i) => {
  const price = priceBooking(p, i);
  let bookingStatus = "SUCCESS";
  if (i === 9) bookingStatus = "FAILED";
  return { p, i, price, bookingStatus };
});

const pricing1021 = PAX[1021].map((p, i) => ({ p, i, price: priceBooking(p, i) }));
const pricing1022 = PAX[1022].map((p, i) => ({ p, i, price: priceBooking(p, i) }));

const paxCount = (list) => sum(list, (p) => p.adults + p.children);

const FLIGHTS = [
  {
    id: 1025, flightNumber: "WA0063", dep: "CDG", arr: "EWR", date: "2026-11-26",
    status: "draft", bookings: [], totalCost: 0,
    reason: "technical_issue", reasonText: "Technical issue",
  },
  {
    id: 1024, flightNumber: "WA0244", dep: "CDG", arr: "YUL", date: "2026-11-26",
    status: "in_progress", bookings: PAX[1024], totalCost: 0,
    reason: "weather_disruption", reasonText: "Weather disruption",
  },
  {
    id: 1023, flightNumber: "WA0021", dep: "CDG", arr: "JFK", date: "2026-11-26",
    status: "passengers_booking_confirmed", bookings: PAX[1023],
    totalCost: sum(ALLOC_1023.filter((a) => a.bookingStatus === "SUCCESS"), (a) => a.price.total),
    reason: "technical_issue", reasonText: "Technical issue",
  },
  {
    id: 1022, flightNumber: "WA0318", dep: "AMS", arr: "ORD", date: "2026-11-25",
    status: "hotel_allocation_in_progress", bookings: PAX[1022],
    totalCost: sum(pricing1022.slice(0, 14), (a) => a.price.total),
    reason: "crew_unavailability", reasonText: "Crew unavailability",
  },
  {
    id: 1021, flightNumber: "WA0137", dep: "CDG", arr: "BOS", date: "2026-11-25",
    status: "allocated", bookings: PAX[1021],
    totalCost: sum(pricing1021, (a) => a.price.total),
    reason: "weather_disruption", reasonText: "Weather disruption",
  },
  {
    id: 1020, flightNumber: "WA0412", dep: "FRA", arr: "IAD", date: "2026-11-23",
    status: "published", bookingsCount: 31, passengers: 64, totalCost: 9842.6,
    reason: "air_traffic_control", reasonText: "Air traffic control",
  },
  {
    id: 1019, flightNumber: "WA0509", dep: "MAD", arr: "MIA", date: "2026-11-21",
    status: "published", bookingsCount: 14, passengers: 27, totalCost: 4118.35,
    reason: "technical_issue", reasonText: "Technical issue",
  },
  {
    id: 1018, flightNumber: "WA0722", dep: "LIS", arr: "BOS", date: "2026-11-19",
    status: "published", bookingsCount: 22, passengers: 45, totalCost: 6904.1,
    reason: "weather_disruption", reasonText: "Weather disruption",
  },
];
const flightById = (id) => FLIGHTS.find((f) => f.id === Number(id));
const nextDay = (d) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

function listItem(f) {
  return {
    id: f.id,
    flightNumber: f.flightNumber,
    departureAirport: airport(f.dep),
    arrivalAirport: airport(f.arr),
    cancellationDate: `${f.date}T06:00:00.000Z`,
    totalBookings: f.bookings ? f.bookings.length : f.bookingsCount,
    totalPassengers: f.bookings ? paxCount(f.bookings) : f.passengers,
    totalCost: f.totalCost,
    status: f.status,
  };
}

function review(f, state) {
  const bookings = bookingsFor(f, state);
  return {
    flight: {
      id: f.id,
      flightNumber: f.flightNumber,
      airlineId: AIRLINE.id,
      departureAirportId: airport(f.dep).id,
      arrivalAirportId: airport(f.arr).id,
      route: { departureAirport: airport(f.dep), arrivalAirport: airport(f.arr) },
      cancellationDate: `${f.date}T06:00:00.000Z`,
      checkInDate: f.date,
      checkOutDate: nextDay(f.date),
      cancellationReason: f.reason,
      cancellationReasonText: f.reasonText,
      status: f.status,
      createdAt: `${f.date}T05:40:00.000Z`,
      updatedAt: `${f.date}T08:20:00.000Z`,
    },
    summary: {
      totalBookings: bookings.length || f.bookingsCount || 0,
      totalAdults: sum(bookings, (b) => b.adults),
      totalChildren: sum(bookings, (b) => b.children),
    },
  };
}

/** Flight 1024's bookings only exist after the CSV import in the capture script. */
function bookingsFor(f, state) {
  if (f.id === 1024 && !state.imported1024) return [];
  return f.bookings || [];
}

// Failed CSV rows for flight 1024 (rows needing fixes).
const FAILED_1024 = [
  {
    id: 9001,
    rowNumber: 8,
    fileName: "WA0244_passenger_manifest.csv",
    values: {
      pnr: "SKY8WP", firstName: "Joe", lastName: "Bloggs",
      email: "joe.bloggs@example", phone: "+1 555 0147", residency: "GB",
      travelClass: "economy", adults: "2", children: "0", childAges: [], specialNotes: "",
    },
    errors: [{ field: "email", message: "Email must be a valid email address" }],
    createdAt: "2026-11-26T09:12:00.000Z",
  },
  {
    id: 9002,
    rowNumber: 15,
    fileName: "WA0244_passenger_manifest.csv",
    values: {
      pnr: "SKY5NL", firstName: "Erika", lastName: "Mustermann",
      email: "erika.mustermann@example.com", phone: "+1 555 0152", residency: "DE",
      travelClass: "Premium", adults: "2", children: "2", childAges: ["6"], specialNotes: "Traveling with infant",
    },
    errors: [
      { field: "travelClass", message: "Travel class \"Premium\" is not recognised. Use Economy, Premium Economy, Business or First Class" },
      { field: "childAges", message: "2 children but 1 age given. Enter one age per child" },
    ],
    createdAt: "2026-11-26T09:12:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Allocation (flight 1023, WA0021)
// ---------------------------------------------------------------------------
function allocationResult(a) {
  const { p, price, bookingStatus } = a;
  const booked = bookingStatus === "SUCCESS" || bookingStatus === "MANUAL_CHECK";
  const reasons = {
    SUCCESS: null,
    FAILED: "No room split could place 4 adults + 1 child within 15 km at 3 stars or more.",
    MANUAL_CHECK: "Supplier did not confirm in time. Check the booking with the supplier before rebooking.",
  };
  return {
    bookingId: p.id,
    pnr: p.pnr,
    travelClass: p.travelClass,
    processingOrder: a.i + 1,
    bookingStatus,
    hotel: booked
      ? {
          hotelCode: price.hotel.hotelCode,
          hotelName: price.hotel.hotelName,
          category: price.hotel.category,
          address: null,
          checkInDate: "2026-11-26",
          checkOutDate: "2026-11-27",
          totalRooms: price.rooms,
          totalPrice: price.total,
          rooms: [],
        }
      : null,
    providerBookingReference: bookingStatus === "SUCCESS" ? supplierRef(a.i) : null,
    attempts: bookingStatus === "SUCCESS" ? 1 : 2,
    reason: reasons[bookingStatus],
    reasonCode: bookingStatus === "FAILED" ? "NO_ROOM_SPLIT" : null,
    adults: p.adults,
    children: p.children,
  };
}

function allocationCounts(list) {
  const c = (s) => list.filter((a) => a.bookingStatus === s).length;
  return {
    totalPnrs: list.length,
    successfulPnrs: c("SUCCESS"),
    pendingPnrs: c("PENDING"),
    failedPnrs: c("FAILED"),
    manualCheckPnrs: c("MANUAL_CHECK"),
    notStartedPnrs: c("NOT_STARTED"),
  };
}

function allocationStatus(flightId) {
  const list =
    flightId === 1023
      ? ALLOC_1023
      : (flightId === 1021 ? pricing1021 : []).map((x) => ({ ...x, bookingStatus: "SUCCESS" }));
  const counts = allocationCounts(list);
  const booked = list.filter((a) => a.bookingStatus === "SUCCESS");
  const fullyBooked = counts.successfulPnrs === counts.totalPnrs && counts.totalPnrs > 0;
  return {
    cancelledFlightId: flightId,
    status: flightById(flightId)?.status,
    running: false,
    lastRunError: null,
    ...counts,
    processedPnrs: counts.totalPnrs - counts.notStartedPnrs,
    fullyBooked,
    canRetry: true,
    awaitingSupplierCheck: false,
    nextSupplierCheckAt: null,
    results: list.map(allocationResult),
    totalPrice: sum(booked, (a) => a.price.total),
    totalRooms: sum(booked, (a) => a.price.rooms),
    totalActualPrice: sum(booked, (a) => a.price.cost),
    totalSellingPrice: sum(booked, (a) => a.price.cost),
    totalDiscounts: sum(booked, (a) => a.price.discount),
    totalHotelTaxes: sum(booked, (a) => a.price.tax),
    totalPlatformFee: sum(booked, (a) => a.price.fee),
    currency: "USD",
  };
}

function allocationProgress(flightId) {
  const full = allocationStatus(flightId);
  const { results, totalPrice, totalRooms, totalActualPrice, totalSellingPrice,
    totalDiscounts, totalHotelTaxes, totalPlatformFee, currency, canRetry,
    awaitingSupplierCheck, nextSupplierCheckAt, ...progress } = full;
  return progress;
}

// ---------------------------------------------------------------------------
// Booking summary (flight 1021, WA0137, fully allocated)
// ---------------------------------------------------------------------------
function hotelSummary(flightId) {
  const list = flightId === 1021 ? pricing1021 : [];
  return {
    summary: {
      totalBookings: list.length,
      totalAdults: sum(list, (a) => a.p.adults),
      totalChildren: sum(list, (a) => a.p.children),
      totalRooms: sum(list, (a) => a.price.rooms),
      totalHotelCost: sum(list, (a) => a.price.cost),
      totalDiscount: sum(list, (a) => a.price.discount),
      totalHotelTax: sum(list, (a) => a.price.tax),
      totalPlatformFee: sum(list, (a) => a.price.fee),
      totalPayable: sum(list, (a) => a.price.total),
    },
  };
}

function hotelBookingsList(flightId) {
  const list = flightId === 1021 ? pricing1021 : [];
  return {
    hotelBookings: list.map(({ p, i, price }) => ({
      id: 5301 + i,
      passengerBooking: {
        id: p.id,
        cancelledFlightId: flightId,
        pnr: p.pnr,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        travelClass: p.travelClass,
        adults: p.adults,
        children: p.children,
      },
      cancelledFlightId: flightId,
      hotelName: price.hotel.hotelName,
      rating: price.hotel.category,
      totalRooms: price.rooms,
      totalCost: price.total,
      status: "confirmed",
      bookingReference: supplierRef(i),
      reason: null,
      createdAt: "2026-11-25T14:02:00.000Z",
      updatedAt: "2026-11-25T14:02:00.000Z",
    })),
    totalHotelBookings: list.length,
    currentPage: 1,
    limit: 10,
  };
}

// ---------------------------------------------------------------------------
// Dashboard (Year view: Jan to Nov 2026, monthly)
// ---------------------------------------------------------------------------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November"];
const SPEND = [18420.5, 22950.0, 15780.25, 26310.8, 31240.0, 38960.45, 44120.9,
  41380.0, 29870.6, 33650.15, 47215.4];
const PASSENGERS = [212, 268, 181, 304, 356, 431, 498, 462, 337, 381, 529];
const CANCELLED = [5, 7, 4, 8, 9, 11, 13, 12, 9, 10, 14];

function trendBase(timeFrame) {
  return {
    timeFrame,
    granularity: "month",
    timezone: TIMEZONE,
    startDate: "2025-12-31T23:00:00.000Z",
    endDate: "2026-12-31T23:00:00.000Z",
  };
}
const bucket = (i) => `2026-${String(i + 1).padStart(2, "0")}-01`;

const dashboard = {
  spend: (tf) => ({ ...trendBase(tf), points: MONTHS.map((m, i) => ({ bucket: bucket(i), label: m, spend: SPEND[i] })) }),
  passengers: (tf) => ({ ...trendBase(tf), points: MONTHS.map((m, i) => ({ bucket: bucket(i), label: m, passengers: PASSENGERS[i] })) }),
  flights: (tf) => ({ ...trendBase(tf), points: MONTHS.map((m, i) => ({ bucket: bucket(i), label: m, flights: CANCELLED[i] })) }),
  summary: (tf) => {
    const totalHotelBookingCost = sum(SPEND);
    return {
      ...trendBase(tf),
      totalHotelBookingCost,
      totalHotelBookings: 1874,
      totalRooms: 2036,
      totalPlatformFee: round2(totalHotelBookingCost * 0.1),
      platformFeePercentage: 10,
      totalCancelFlights: sum(CANCELLED),
      totalAdults: 3412,
      totalChildren: sum(PASSENGERS) - 3412,
    };
  },
};

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
const CREDIT_LIMIT = 100000;
// Chronological; amounts positive. Balance chain computed below.
const WALLET_EVENTS = [
  ["2026-11-02T09:00:00Z", "CREDIT", "ADJUSTMENT", 50000, "Wallet top-up (bank transfer)", "SUCCESS"],
  ["2026-11-19T15:12:00Z", "DEBIT", "BOOKING", 6904.1, "Hotel bookings · WA0722 · 22 PNRs", "SUCCESS"],
  ["2026-11-21T13:47:00Z", "DEBIT", "BOOKING", 4118.35, "Hotel bookings · WA0509 · 14 PNRs", "SUCCESS"],
  ["2026-11-23T11:05:00Z", "DEBIT", "BOOKING", 9842.6, "Hotel bookings · WA0412 · 31 PNRs", "SUCCESS"],
  ["2026-11-24T08:30:00Z", "CREDIT", "ADJUSTMENT", 25000, "Wallet top-up (bank transfer)", "SUCCESS"],
  ["2026-11-25T14:02:00Z", "DEBIT", "BOOKING", sum(pricing1021, (a) => a.price.total), "Hotel bookings · WA0137 · 10 PNRs", "SUCCESS"],
  ["2026-11-25T16:40:00Z", "DEBIT", "BOOKING", flightById(1022).totalCost, "Hotel bookings · WA0318 · 14 of 22 PNRs", "SUCCESS"],
  ["2026-11-26T07:55:00Z", "CREDIT", "ADJUSTMENT", 15000, "Wallet top-up (bank transfer)", "SUCCESS"],
  ["2026-11-26T08:41:00Z", "DEBIT", "BOOKING", flightById(1023).totalCost, "Hotel bookings · WA0021 · 16 of 18 PNRs", "SUCCESS"],
];
const OPENING = 12480.0;

function walletTransactions() {
  let bal = OPENING;
  const txs = WALLET_EVENTS.map(([createdAt, transactionType, type, amount, reason, status], i) => {
    const openingBalance = round2(bal);
    const applied = status === "SUCCESS" ? (transactionType === "CREDIT" ? amount : -amount) : 0;
    const closingBalance = round2(bal + applied);
    bal = closingBalance;
    return {
      id: 2140 + i,
      airline: { ...AIRLINE },
      openingBalance,
      transactionAmount: round2(amount),
      closingBalance: status === "SUCCESS" ? closingBalance : openingBalance,
      transactionType,
      type,
      creditLimit: CREDIT_LIMIT,
      reason,
      status,
      createdAt,
    };
  });
  return { txs: txs.reverse(), balance: round2(bal) };
}

function walletBalance() {
  const { balance } = walletTransactions();
  return {
    walletId: 3,
    airlineId: AIRLINE.id,
    balance,
    creditLimit: CREDIT_LIMIT,
    lockedAmount: 0,
    currency: "USD",
    updatedAt: "2026-11-26T08:41:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const ok = (data, message = "OK") => ({
  success: true,
  requestId: "req-mock-0001",
  timestamp: NOW,
  message,
  data,
});

/**
 * Returns { status, body } for a mocked API request, or null if unhandled.
 * `state` is mutable per capture run (e.g. { imported1024: true }).
 */
export function handleApi(method, path, query, state) {
  const seg = path.replace(/^\/api\/v1/, "").replace(/\/$/, "");
  let m;

  if (method === "GET" && seg === "/airline/users/profile") return { body: ok(userProfile) };
  if (method === "GET" && seg === "/airline/profile") return { body: ok(airlineProfile) };

  if (method === "GET" && seg === "/wallets/balance") return { body: ok(walletBalance()) };
  if (method === "GET" && seg === "/wallets/transactions") {
    const { txs } = walletTransactions();
    return {
      body: ok({ transactions: txs, pagination: { currentPage: 1, limit: 10, totalCount: txs.length } }),
    };
  }

  if (method === "GET" && seg.startsWith("/dashboard/airline/")) {
    const tf = query.get("timeFrame") || "year";
    const kind = seg.split("/").pop();
    if (kind === "hotel-spend-trend") return { body: ok(dashboard.spend(tf)) };
    if (kind === "affected-passengers-trend") return { body: ok(dashboard.passengers(tf)) };
    if (kind === "cancelled-flights-trend") return { body: ok(dashboard.flights(tf)) };
    if (kind === "summary") return { body: ok(dashboard.summary(tf)) };
  }

  if (method === "GET" && seg === "/airports") {
    const list = AIRPORTS.map((a) => ({ id: a.id, name: a.name, iataCode: a.iataCode }));
    return { body: ok({ airports: list, total: list.length, currentPage: 1, totalPages: 1, limit: list.length }) };
  }

  if (method === "GET" && seg === "/cancelled-flights") {
    if (query.get("shorten") === "true") {
      return {
        body: ok({
          cancelledFlights: FLIGHTS.map((f) => ({ id: f.id, flightNumber: f.flightNumber, cancellationDate: `${f.date}T06:00:00.000Z` })),
          pagination: { page: 1, limit: 10, totalCount: FLIGHTS.length },
        }),
      };
    }
    return {
      body: ok({
        cancelledFlights: FLIGHTS.map(listItem),
        pagination: { page: 1, limit: 10, totalCount: FLIGHTS.length },
      }),
    };
  }

  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/review$/)) && method === "GET") {
    const f = flightById(m[1]);
    return f ? { body: ok(review(f, state)) } : { status: 404, body: { success: false, message: "Not found" } };
  }

  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/bookings$/)) && method === "GET") {
    const f = flightById(m[1]);
    const bookings = f ? bookingsFor(f, state) : [];
    return { body: ok({ bookings, pagination: { page: 1, limit: 50, totalCount: bookings.length } }) };
  }

  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/booking-import-failures$/)) && method === "GET") {
    const failed = Number(m[1]) === 1024 && state.imported1024 ? FAILED_1024 : [];
    return { body: ok({ failedBookings: failed }) };
  }

  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/bookings\/import$/)) && method === "POST") {
    state.imported1024 = true;
    const bookings = PAX[1024];
    return {
      body: ok(
        {
          bookings,
          failedBookings: FAILED_1024,
          summary: {
            totalBookings: bookings.length + FAILED_1024.length,
            validBookings: bookings.length,
            errorBookings: FAILED_1024.length,
          },
        },
        `${bookings.length} booking(s) imported, ${FAILED_1024.length} failed`,
      ),
    };
  }

  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/hotel-allocations\/progress$/)) && method === "GET") {
    return { body: ok(allocationProgress(Number(m[1]))) };
  }
  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/hotel-allocations$/)) && method === "GET") {
    return { body: ok(allocationStatus(Number(m[1]))) };
  }
  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/hotel-summary$/)) && method === "GET") {
    return { body: ok(hotelSummary(Number(m[1]))) };
  }
  if ((m = seg.match(/^\/cancelled-flights\/(\d+)\/hotel-bookings$/)) && method === "GET") {
    return { body: ok(hotelBookingsList(Number(m[1]))) };
  }

  return null;
}
