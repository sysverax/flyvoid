# Hotel Allocation Strategy — Sysverax
## `POST /api/v1/cancelled-flights/:cancelledFlightId/allocate-hotels`

---

## 1. Overview

This document describes the **bulk hotel allocation strategy** for a cancelled flight.
When triggered, the system automatically allocates and books hotel rooms for **every confirmed PNR** under the flight in a single API call.

This is different from the existing per-booking APIs:
- `GET  /bookings/:bookingId/hotel-recommendations` → recommendations for one PNR
- `POST /bookings/:bookingId/check-rate`            → rate check for one PNR
- `POST /bookings/:bookingId/book-hotel`            → book hotel for one PNR
- `POST /bookings/:bookingId/allocate-hotel`        → allocate for one PNR

**The new API allocates ALL PNRs at once**, using AI-driven grouping, scoring, and immediate booking via Hotelbeds.

---

## 2. Prerequisites

Before this API can be triggered:
- Cancelled flight record must exist
- All PNR bookings must be entered
- Admin must have confirmed all bookings (status = confirmed)

---

## 3. Full Allocation Flow

```
POST /api/v1/cancelled-flights/:cancelledFlightId/allocate-hotels
        │
        ▼
Step 1: Fetch flight with relations
        - departureAirport (latitude, longitude, iataCode)
        - airline (hotel preferences: allowed stars, max distance)
        - all confirmed bookings
        │
        ▼
Step 2: Validate
        - Flight exists
        - Flight status allows allocation
        - At least one confirmed booking exists
        - No existing allocations (prevent duplicate run)
        │
        ▼
Step 3: Group PNRs by travel class
        - Read travelClass from each booking entity
        - Produce: { "business": [bookings...], "economy": [bookings...], ... }
        - Rank classes by priority: first > business > premium_economy > economy
        │
        ▼
Step 4: AI sub-groups each class by special notes (Groq)
        - Pass all specialNotes + additionalNotes for PNRs in each class
        - Groq semantically clusters them into sub-groups
        - Example sub-groups: "meal-requirements", "accessibility", "family-children", "standard"
        - Result: { "business": [ { subGroup: "accessibility", bookings: [...] }, ... ] }
        │
        ▼
Step 5: Fetch hotels from Hotelbeds (ONE call for the flight)
        - Use departureAirport latitude + longitude
        - Apply airline preferences: allowed star ratings, max radius (km)
        - Use flight cancellationDate as checkIn, checkIn + 1 day as checkOut
        - Retrieve: hotel name, stars, amenities, room types, room capacity, minRate, rateKey
        │
        ▼
Step 6: AI scores hotels per sub-group (Groq)
        - For each sub-group, pass: class priority, special needs profile, passenger counts, all hotels
        - Groq returns scored hotel list for that sub-group
        - Scoring factors: class priority match, special needs amenity match,
          star rating, room type availability, distance, price
        - Hard filter before scoring: accessibility sub-groups only see accessible hotels
        │
        ▼
Step 7: Room type matching per PNR
        - For each PNR in the sub-group, total passengers = adults + children
        - Match best-fit room type from hotel's available room types:
            1 person  → Single
            2 persons → Double / Twin
            3 persons → Triple
            4-6 persons → Family Room
            2 persons premium → King / Suite
        - Fallback if room type details missing: ceil(passengers / 2) rooms at 2 persons each
        - Track running room inventory per hotel (decrement as allocated)
        - If hotel is full → move to next best scored hotel
        - Never allocate same room to two PNRs
        │
        ▼
Step 8: Book on Hotelbeds immediately (per allocation)
        - Call Hotelbeds booking API with rateKey
        - Receive bookingReference
        - On rateKey expiry: re-search same hotel once and retry
        - On hotel fully booked: try next scored hotel for that sub-group
        - On vendor failure: mark PNR as allocation_failed, continue other PNRs
        │
        ▼
Step 9: Save hotel_allocations records (one per PNR)
        - cancelled_flight_id, booking_id
        - hotel_name, hotel_address
        - check_in_date, check_out_date
        - total_rooms, cost_per_room
        - price, buying_price, selling_price, platform_fee, earnings
        - booking_reference, rate_key
        - status = "confirmed"
        - vendor = "hotelbeds"
        │
        ▼
Step 10: Update cancelled_flights totals
        - total_hotel_rooms = sum of all rooms allocated
        - total_price       = sum of all allocation prices
        - total_buying_price, total_selling_price, total_platform_fee, total_earnings
        │
        ▼
Step 11: Return full response
        - Per PNR: hotel, room type, rooms count, cost breakdown, bookingReference, status
        - Flight totals
        - failedAllocations list (if any)
```

---

## 4. PNR Grouping Detail

### 4.1 Group by Travel Class

```
All confirmed bookings
  ├── first_class     → [PNR001, PNR005]
  ├── business        → [PNR002, PNR006, PNR010]
  ├── premium_economy → [PNR003, PNR007]
  └── economy         → [PNR004, PNR008, PNR009]
```

Classes are read dynamically from booking.travelClass — no fixed class list assumed.
Priority rank: first > business > premium_economy > economy (any others rank lowest).

### 4.2 AI Sub-grouping by Special Notes

Within each class, Groq AI reads all specialNotes arrays and additionalNotes fields
and clusters PNRs with semantically similar needs:

```
business class
  ├── sub-group: "accessibility"       → PNRs with wheelchair / mobility needs
  ├── sub-group: "meal-requirements"   → PNRs with halal, kosher, vegan, breakfast needs
  ├── sub-group: "family-children"     → PNRs travelling with children / infants
  └── sub-group: "standard"           → PNRs with no special notes
```

Groq prompt must return structured JSON:
```json
{
  "subGroups": [
    {
      "id": "accessibility",
      "label": "Accessibility Requirements",
      "bookingIds": [10, 14],
      "needsProfile": "wheelchair access, ground floor rooms, accessible bathroom"
    },
    {
      "id": "meal-requirements",
      "label": "Meal Requirements",
      "bookingIds": [2, 6],
      "needsProfile": "halal meals, breakfast included"
    }
  ]
}
```

---

## 5. Hotel Fetching Detail

### 5.1 Search Parameters
- Center point: departure airport latitude + longitude
- Radius: from airline.hotelPreferences.maxDistanceKm
- checkIn: flight.cancellationDate
- checkOut: cancellationDate + 1 day
- Occupancy: 1 room, 1 adult (proxy search — actual rooms calculated by system)

### 5.2 Airline Star Filter
- Read allowed star ratings from airline hotel preferences
- Pass as filter to Hotelbeds or filter results after fetch
- Example: airline allows [3, 4, 5] → exclude hotels with stars outside this range

### 5.3 What to Extract Per Hotel
```
{
  id: "hb-{hotelCode}",
  name: string,
  address: string,
  stars: number,
  amenities: string[],          // WiFi, Restaurant, Pool, Wheelchair Access, etc.
  isAccessible: boolean,        // true if wheelchair / accessible amenities present
  roomTypes: [
    {
      type: "double" | "single" | "triple" | "family" | "suite" | "king",
      capacity: number,         // max persons this room holds
      pricePerNight: number,
      rateKey: string,
      available: number         // rooms available of this type
    }
  ],
  minRate: number,
  totalAvailableRooms: number,  // running counter, decremented as allocated
  vendor: "hotelbeds"
}
```

---

## 6. Room Matching Logic

### 6.1 Per PNR
```
totalPassengers = booking.adults + booking.children

Find smallest room type where roomType.capacity >= totalPassengers
  → assign that room type, decrement hotel.totalAvailableRooms

If no single room fits all passengers:
  → assign multiple rooms (e.g. family room + single)
  → sum cost across rooms

Fallback (no room type data):
  → roomsNeeded = ceil(totalPassengers / 2)
  → costPerRoom = hotel.minRate
```

### 6.2 Hotel Capacity Tracking
```
Before allocation starts:
  hotelInventory = Map<hotelId, remainingRooms>

After each PNR allocation:
  hotelInventory[hotelId] -= roomsAllocated

If hotelInventory[hotelId] === 0:
  hotel is full → skip for remaining PNRs
```

---

## 7. AI Scoring Prompt Structure (Groq)

### Input per sub-group:
```json
{
  "subGroup": {
    "travelClass": "business",
    "classPriority": 2,
    "needsProfile": "wheelchair access, ground floor",
    "totalPassengers": 8,
    "bookingCount": 3
  },
  "hotels": [ ...HotelCandidate[] ]
}
```

### Expected output:
```json
{
  "scoredHotels": [
    {
      "hotelId": "hb-1234",
      "score": 95,
      "reason": "5-star, fully accessible, restaurant on-site, 2km from airport"
    },
    {
      "hotelId": "hb-5678",
      "score": 72,
      "reason": "4-star, accessible facilities, slightly farther at 8km"
    }
  ]
}
```

---

## 8. Cost Calculation Per Allocation

```
price         = roomsAllocated × costPerRoom × nights
buying_price  = vendor net rate (Hotelbeds rate)
selling_price = buying_price + platform markup
platform_fee  = fixed or percentage fee
earnings      = selling_price - buying_price - platform_fee
```

---

## 9. Response Structure

```json
{
  "flightId": 1,
  "flightNumber": "SW1234",
  "status": "allocation_complete",
  "summary": {
    "totalPNRs": 10,
    "successfulAllocations": 9,
    "failedAllocations": 1,
    "totalRoomsAllocated": 12,
    "totalCost": 1450.00
  },
  "allocations": [
    {
      "bookingId": 5,
      "pnr": "PNR001",
      "passengerName": "John Smith",
      "travelClass": "business",
      "subGroup": "accessibility",
      "adults": 2,
      "children": 0,
      "hotel": {
        "name": "Club Hotel Dolphin",
        "address": "Near Airport, Negombo",
        "stars": 4,
        "checkIn": "2026-09-01",
        "checkOut": "2026-09-02"
      },
      "rooms": [
        {
          "roomType": "Double Room",
          "capacity": 2,
          "pricePerNight": 85.00,
          "totalCost": 85.00
        }
      ],
      "totalRooms": 1,
      "totalCost": 85.00,
      "buyingPrice": 75.00,
      "sellingPrice": 90.00,
      "platformFee": 5.00,
      "earnings": 10.00,
      "bookingReference": "HB-789123",
      "vendor": "hotelbeds",
      "status": "confirmed"
    }
  ],
  "failedAllocations": [
    {
      "bookingId": 8,
      "pnr": "PNR008",
      "reason": "No available rooms matching passenger requirements",
      "status": "allocation_failed"
    }
  ]
}
```

---

## 10. Multi-Vendor Architecture (Initial: Hotelbeds only)

All vendor calls go through an abstraction interface:

```typescript
interface IHotelVendor {
  searchHotels(params: SearchParams): Promise<HotelCandidate[]>
  bookHotel(params: BookParams): Promise<BookingResult>
  cancelBooking(ref: string): Promise<void>
}
```

- `HotelbedsVendor` implements `IHotelVendor`
- `HotelVendorService` acts as registry — selects vendor by airline config
- Adding new vendor = implement interface + register. Zero changes to allocation logic.

---

## 11. Error Handling

| Scenario | Behaviour |
|---|---|
| Hotel fully booked at booking time | Try next best scored hotel |
| rateKey expired | Re-search same hotel once, retry |
| Vendor API timeout | Retry once, then mark PNR as allocation_failed |
| No hotels available | Return error, admin handles manually |
| Partial success | Return mixed result — show success + failed separately |
| Airline filter too restrictive | Return error with suggestion to relax settings |
| Duplicate allocation attempt | Return 409 Conflict |

---

## 12. Key Rules

- Hotels are booked **immediately** — no admin confirmation step after this API
- Same room is **never allocated to two PNRs**
- Accessibility needs are a **hard filter**, not a scoring factor
- AI is called **per sub-group**, not per individual PNR (performance)
- Vendor logic is **fully isolated** from allocation logic
- Partial failures do **not** roll back successful allocations

