import type {
  HotelAvailabilityHotel,
  HotelAvailabilityResult,
  HotelAvailabilityRoom,
  HotelAvailabilityTax,
} from "@/src/services/hotel-availability.service";

/** "1 room · 2 adults · 1 child" */
export function describeRooms(rooms: HotelAvailabilityRoom[]): string {
  const adults = rooms.reduce((sum, room) => sum + room.adults, 0);
  const children = rooms.reduce((sum, room) => sum + room.childrenAges.length, 0);
  const parts = [
    `${rooms.length} room${rooms.length === 1 ? "" : "s"}`,
    `${adults} adult${adults === 1 ? "" : "s"}`,
  ];
  if (children > 0) parts.push(`${children} child${children === 1 ? "" : "ren"}`);
  return parts.join(" · ");
}

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const taxTotal = (taxes: HotelAvailabilityTax[]): string =>
  taxes.map((tax) => `${tax.amount.toFixed(2)}${tax.currency ? ` ${tax.currency}` : ""}`).join("; ");

/**
 * The hotels as CSV, one row per room option, with the search written on the
 * first lines so the file still makes sense later.
 */
export function hotelsToCsv(result: HotelAvailabilityResult, hotels: HotelAvailabilityHotel[]): string {
  const meta: Array<[string, string]> = [
    ["Provider", result.provider.name],
    ["Airport", `${result.airport.code} · ${result.airport.name}`],
    ["Check-in", result.checkInDate],
    ["Check-out", result.checkOutDate],
    ["Nights", String(result.nights)],
    [
      "Rooms & guests",
      result.rooms
        .map(
          (room, i) =>
            `Room ${i + 1}: ${room.adults} adult(s)${room.childrenAges.length ? `, children aged ${room.childrenAges.join("/")}` : ""}`,
        )
        .join("; "),
    ],
    ["Radius", `${result.radius} ${result.radiusUnit}`],
    ["Guest country", result.residency],
    ["Searched at", result.searchedAt],
    ["Prices", "Supplier net price; total stay covers all rooms and nights"],
  ];
  const header = [
    "HID",
    "Hotel",
    "Stars",
    "Distance (km)",
    "Address",
    "Room type",
    "Meal plan",
    "Max guests",
    "Price per night",
    "Total stay",
    "Currency",
    "Taxes included",
    "Taxes at hotel",
    "Free cancellation until",
    "Penalty after",
    "Rooms available",
    "Room features",
  ];
  const rows = hotels.flatMap((hotel) =>
    hotel.options.map((option) => [
      hotel.hid ?? hotel.hotelCode,
      hotel.name,
      hotel.stars || "",
      hotel.distanceKm ?? "",
      hotel.address ?? "",
      option.roomType,
      option.mealPlan,
      option.maxGuests ?? "",
      option.pricePerNight.toFixed(2),
      option.totalPrice.toFixed(2),
      option.currency,
      taxTotal(option.taxesIncluded),
      taxTotal(option.taxesAtProperty),
      option.cancellation.freeUntil ?? "Non-refundable",
      option.cancellation.penaltyAmount?.toFixed(2) ?? "",
      option.roomsAvailable ?? "",
      option.features.join("; "),
    ]),
  );
  return [
    ...meta.map((line) => line.map(csvCell).join(",")),
    "",
    header.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
}

/** Downloads text as a file (UTF-8 with BOM so Excel reads accents). */
export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
