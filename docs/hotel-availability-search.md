# Hotel Availability Search (Admin Portal)

Status: implemented (backend + admin portal `/hotels`).

## Goal

Give platform admins a **Hotels** page where they can see which hotels a
supplier (e.g. RateHawk) has available near an airport, for chosen dates and
guests. It is **view only**: nothing is booked, held, or charged.

## Decisions

| Topic | Decision |
|---|---|
| Starting state | Page is empty until a **provider** and an **airport** are selected, then the admin clicks **Search**. |
| Dates | Check-in defaults to **today + 14 days** (in the airport's timezone), check-out to check-in + 1 night. Both editable. |
| Rooms / guests | Default **1 room, 2 adults, 0 children**. Admin can add rooms (max 9) and set adults (1–6) and children per room; each child needs an age (0–17). |
| Radius | Editable in the UI. Default `HOTEL_SEARCH_RADIUS` (10 km), maximum **70 km** (RateHawk's `serp/geo` limit). One fixed radius per search, no auto-widening. |
| Residency (guest country) | Country dropdown, defaults to the **selected airport's country** (`airports.country_code`), changeable. |
| Price | **Supplier price only.** No airline price. |
| Caching | **None for now.** Typical search is 1 room, 2 adults = 1 supplier call. |
| Export | **CSV**, built in the browser from the loaded results (no API call). |
| Access | New platform asset **`HOTELS`**: VIEW for the page, EXPORT for the export button. |

## Backend

### Module layout

New module, separate from `cancelled-flights` (flight/PNR scoped) and
`hotel-bookings` (stored booking records):

```
backend/src/hotel-availability/
  hotel-availability.module.ts
  hotel-availability.controller.ts    GET /hotel-availability
  hotel-availability.service.ts       validation, supplier call, mapping, logs
  dto/
    hotel-availability-query.dto.ts
    hotel-availability-response.dto.ts
backend/test-unit/hotel-availability/
  hotel-availability.service.spec.ts
```

### Shared supplier adapters

Today `hotel-provider.registry.ts` creates **one** adapter, picked by the
`HOTEL_PROVIDER` env variable. Two problems for this page:

1. The provider dropdown could not switch suppliers.
2. RateHawk's rate limiter (10 `serp/geo` calls/min) lives inside the adapter
   instance. A second instance would have its own counter, so together they
   could exceed RateHawk's limit and break allocation.

Fix (implemented): `hotel-provider.registry.ts` registers **both** adapters
once in `CancelledFlightsModule`, plus:

- `HOTEL_PROVIDER` → `useExisting` the env-selected adapter (allocation, unchanged);
- `HotelProviderRegistry` → `get(code)` / `isConfigured(code)` (exported).

`HotelAvailabilityModule` imports `CancelledFlightsModule`, so both features
share the same adapter instances (one RateHawk rate limiter). Environments
without RateHawk credentials log the existing "credentials not configured"
warning on start-up; no crash. `GET /hotel-providers` returns `isConfigured`.

Hotel static content (real name, stars, address, coordinates) comes from
`HotelContentService.ensureHotelContent(codes, …, { code, adapter })`, which
now accepts a provider other than the env-selected one.

### Coordinates

- Search centre = the **airport's** latitude/longitude (from `airports`).
- Hotel coordinates (for distance) = our `hotels` table (RateHawk content
  API), else the supplier search response (Hotelbeds). Straight-line km;
  `null` when the hotel has no coordinates.
- RateHawk drops hotels with pay-at-hotel taxes for allocation; this page
  passes `includePayAtHotel` so they are shown, with the taxes listed.
- Several rooms need a supplier with multiroom search (RateHawk); Hotelbeds
  is one room per search (400 otherwise).

### Endpoint

`GET /hotel-availability`, platform users only,
`RequireAccessControl(HOTELS, VIEW)`.

Query (`HotelAvailabilityQueryDto`):

| Param | Type | Rules |
|---|---|---|
| `providerId` | int | required, provider must exist, be active and configured |
| `airportId` | int | required, airport must exist and have coordinates |
| `checkInDate` | `YYYY-MM-DD` | required, calendar date (`CalendarDateField`), not before today at the airport's timezone |
| `checkOutDate` | `YYYY-MM-DD` | required, after `checkInDate`, at most 30 nights |
| `rooms` | JSON string | required, 1–9 rooms, each `{ adults: 1–6, childrenAges: number[] (0–17, max 4) }` |
| `radius` | number | optional, 1–70 (km), default `config.hotelSearch.defaultRadius` |
| `residency` | ISO 3166-1 alpha-2 | optional, defaults to the airport's `countryCode` |

Check-in/check-out are **calendar dates** (no timezone conversion), per
`docs/guidelines/time-frame-apis.md`. "Today" is computed with
`todayIn(airport.timezone)` from `cancelled-flights/stay-dates.ts`.

### Flow

1. Load provider and airport; validate as above.
2. `registry.get(provider.code)` → supplier adapter.
3. Call the existing supplier search:
   - 1 room: `searchNearbyHotelsWithOccupancies(airport, checkIn, checkOut, [room], …, { residency, radius })`
   - 2–9 rooms: `searchMultiRoomOrders(…, [rooms], …)` so rates cover all rooms together.
4. Map each hotel to the response item, sort by distance then price.
5. Log provider, airport, dates, room shapes, radius, residency, hotel count, duration.

One search = one supplier call (1 room → 1 `serp/geo` call; N rooms → 1
multiroom call).

### Supplier mapping additions

`AvailabilityRoomRate` does not carry everything the page shows. Add
**optional** fields (allocation ignores them), filled by the RateHawk mapping:

| Field | Meaning |
|---|---|
| `hid` (on hotel) | RateHawk numeric hotel ID |
| `maxGuests` | room capacity |
| `roomsAvailable` | supplier allotment; `null` when not given |
| `taxesIncluded` | taxes already in the price |
| `taxesAtProperty` | taxes the guest pays at the hotel (not in our price) |
| `features` | room amenities |

Hotelbeds fills what it has; missing values show "—".

### Response

```json
{
  "provider": { "id": 1, "code": "RATEHAWK", "name": "RateHawk" },
  "airport": { "id": 4, "code": "DXB", "name": "Dubai International" },
  "checkInDate": "2026-11-10",
  "checkOutDate": "2026-11-12",
  "nights": 2,
  "rooms": [{ "adults": 2, "childrenAges": [] }],
  "radius": 10,
  "radiusUnit": "km",
  "residency": "AE",
  "searchedAt": "2026-10-27T09:42:11.000Z",
  "hotels": [
    {
      "hid": 6291054,
      "hotelCode": "grand_hotel_dubai",
      "name": "Grand Hotel Dubai",
      "stars": 4,
      "address": "Al Garhoud Rd, Dubai",
      "distanceKm": 3.2,
      "currency": "USD",
      "lowestPricePerNight": 182.4,
      "lowestTotalPrice": 364.8,
      "freeCancellationUntil": "2026-11-08T12:00:00Z",
      "options": [
        {
          "roomType": "Deluxe Double",
          "mealPlan": "Room only",
          "maxGuests": 2,
          "pricePerNight": 182.4,
          "totalPrice": 364.8,
          "taxesIncluded": 21.3,
          "taxesAtProperty": 8.0,
          "cancellation": { "freeUntil": "2026-11-08T12:00:00Z", "penaltyAmount": 182.4 },
          "roomsAvailable": 3,
          "features": ["Wi-Fi", "Air conditioning", "Minibar"]
        }
      ]
    }
  ]
}
```

- Prices are the **supplier net price**. `totalPrice` covers all rooms and all
  nights; `pricePerNight` = `totalPrice / nights`.
- `distanceKm` from airport coordinates to the hotel's coordinates in our
  `hotels` table; `null` when unknown.
- `freeCancellationUntil` (hotel) = best deadline among its options; `null`
  when all are non-refundable or unknown.

### Access control: new `HOTELS` asset

- Add `HOTELS = "HOTELS"` to `PlatformAsset`.
- Migration: replace `chk_platform_access_controls_asset` on
  `platform_access_controls` with the list including `'HOTELS'`.
- Migration also inserts HOTELS VIEW/EDIT/EXPORT rows for existing super admins.
- Sign-in returns every asset for super admins (built from `PlatformAsset`),
  so assets added later need no data migration for them.
- Admin Manage Users modal: add a **Hotels** row (VIEW, EXPORT).

## Admin portal

New sidebar item **Hotels** (`/hotels`), shown with `HOTELS` VIEW.

### Filters card

- Provider (active providers; unconfigured ones disabled)
- Airport (searchable)
- Check-in / check-out date pickers
- Rooms & guests popover: per room adults, children, child ages; "Add room"
- Radius (5 / 10 / 20 / 30 / 50 / 70 km)
- Guest country (searchable; resets to the airport's country when the airport changes)
- **Search** button (enabled once provider and airport are chosen)

### Results

Header line: "42 hotels within 10 km of DXB · Nov 10 – Nov 12 (2 nights) ·
1 room, 2 adults · searched 10:42 AM", with name search, minimum stars, sort
(distance / price / stars) and **⬇ Export CSV** (shown with `HOTELS` EXPORT).

**Hotel row**

| HID | Hotel | Stars | Distance | From (per night) | Total stay | Free cancellation | Rooms |
|---|---|---|---|---|---|---|---|
| 6291054 | Grand Hotel Dubai<br><small>Al Garhoud Rd, Dubai</small> | ★★★★☆ | 3.2 km | USD 182.40 | USD 364.80 | Until Nov 8 | 4 options ▾ |

The RateHawk hotel ID (string) is not shown in the table.

**Expanded row (one line per room option)**

| Room type | Meal plan | Max guests | Price / night | Total stay | Taxes / fees | Cancellation | Available | Features |
|---|---|---|---|---|---|---|---|---|
| Deluxe Double | Room only | 2 | USD 182.40 | USD 364.80 | Incl. USD 21.30<br>+USD 8.00 at hotel | Free until Nov 8 | 3 | Wi-Fi · A/C · +1 more |

- Currency is shown with every price.
- Pay-at-hotel taxes are shown separately because they are not in the supplier price.

States: empty (before first search), searching (spinner), no results (suggest
wider radius / other dates), error banner with **Try again**.

Name search, stars filter, sort and paging work on the loaded results (max 100
hotels from RateHawk) with no new API call.

### Stat cards

Above the table, for the hotels matching the name/stars filters:

| Card | Value |
|---|---|
| Total Hotels | hotels in the (filtered) results |
| Total Rooms | Σ rooms available, each room type counted once at its highest reported availability |
| Passengers Supported | Σ rooms available × max guests per room type |

Rooms and passengers only cover options where the supplier reports
availability / capacity; the hint says "Reported by N of M hotels".

### Export (CSV)

- Built in the browser from the loaded results: **no API call, no rate-limit use**.
- Exports the **current view** (after name search, stars filter, sort).
- One row per room option. File name
  `hotels_<AIRPORT>_<checkIn>_to_<checkOut>.csv`.
- First lines record the search: provider, airport, dates, rooms & guests,
  radius, guest country, searched at.
- Columns: HID, Hotel, Stars, Distance (km), Address, Room type, Meal plan,
  Max guests, Price per night, Total stay, Currency, Taxes included,
  Taxes at hotel, Cancellation policy, Rooms available, Room features.

## Rate limit note

RateHawk allows 10 `serp/geo` calls per minute, shared with live allocation
(one limiter, see "Shared supplier adapters"). The page only searches when
**Search** is clicked. If admin use starts slowing allocations, add a short
result cache.

## Out of scope

- Booking or holding from this page.
- Airline price / platform fee.
- Result caching.
- Excel (.xlsx) export.
