# Hotel Booking APIs - FlyVoid Backend

This document lists all APIs that handle actual hotel bookings in the FlyVoid backend.

## 1. **Core Hotel Booking APIs** (`/api/v1/hotel-bookings`)

### GET /hotel-bookings
- **Description**: List hotel bookings with optional filters
- **Auth**: Airline or Platform user with appropriate access
- **Response**: Paginated list of hotel bookings
- **Features**:
  - Airline users see only their own bookings
  - Platform users see all bookings with additional financial data (buyingPrice, supplierMargin, totalEarning)
  - Filters: destinationAirportId, cancelledFlightId, status (platform only), providerId (platform only)
  - Date range filter: startDate/endDate (hotel booking creation time)

### GET /hotel-bookings/summary
- **Description**: Get summary totals for hotel bookings
- **Auth**: Airline or Platform user
- **Response**: Aggregated booking metrics
- **Features**:
  - Total bookings, passengers, rooms, cost, platform fee
  - Airline users: all bookings; Platform users: CONFIRMED bookings only
  - Additional metrics for platform: supplierMargin, discounts, earnings, paidToHotels

### GET /hotel-bookings/:id
- **Description**: Get details of a single hotel booking
- **Auth**: Airline or Platform user
- **Response**: Full hotel booking details with flight, passenger, and hotel info
- **Features**: Retrieves flight number, passenger details, hotel confirmation

### GET /hotel-bookings/:id/confirmation
- **Description**: Download hotel booking confirmation PDF
- **Auth**: Airline or Platform user with EXPORT access
- **Response**: PDF file for passenger check-in
- **Features**: Generated once flight status is 'paid' or 'published'

### POST /hotel-bookings/:id/send
- **Description**: Send hotel booking confirmation email to passenger
- **Auth**: Airline user with EDIT access
- **Response**: Email sent confirmation
- **Features**: Airline-only action; available once flight is 'paid' or 'published'

---

## 2. **Hotel Allocation APIs** (Primary booking mechanism)
### Path: `/api/v1/cancelled-flights/:id/hotel-allocations`

This is where the **actual hotel booking happens**.

### POST /cancelled-flights/:id/hotel-allocations
- **Description**: **START ACTUAL HOTEL BOOKING PROCESS**
- **HTTP Status**: 202 Accepted (runs in background)
- **Auth**: Airline user with EDIT access
- **Core Functionality**:
  - Validates the flight
  - Claims the allocation run (prevents duplicate runs)
  - Returns immediately (202)
  - **Background Process**:
    - Searches hotel supplier availability ONCE
    - Builds quality-ordered candidate list per PNR
    - Books each PNR live with supplier
    - Processes cabin classes in order: First → Business → Premium Economy → Economy
    - Books PNRs of same class in parallel
    - Attempts fallback hotels one at a time per PNR
    - Charges cost to airline wallet for each confirmed booking
  - **Outcome Tracking**:
    - Confirmed: Booking succeeded
    - In_progress: Currently being processed
    - manual_check: Unknown outcome, needs manual intervention
    - Failed: Booking failed, can be retried
  - **Idempotent**: Skips already-confirmed/manual_check PNRs, retries failed ones

### GET /cancelled-flights/:id/hotel-allocations
- **Description**: Get hotel allocation status and results
- **Auth**: Airline user with VIEW access
- **Response**: 
  - Per-PNR booking status
  - Totals of confirmed bookings
  - Last run error (if any)
  - Running state

### GET /cancelled-flights/:id/hotel-allocations/progress
- **Description**: Lightweight progress polling endpoint
- **Auth**: Airline user with VIEW access
- **Response**: Only run state and per-status PNR counts
- **Features**: Use while `running = true`, then fetch full `/hotel-allocations` for results

---

## 3. **Manual Hotel Booking APIs**
### Path: `/api/v1/cancelled-flights/:id/bookings/:bookingId`

For manual booking when automatic allocation is not applicable.

### GET /cancelled-flights/:id/bookings/:bookingId/hotel-recommendations
- **Description**: Get available hotel options for a specific PNR
- **Auth**: Airline user with VIEW access
- **Response**: List of available hotels with rates
- **Features**:
  - Search by room split
  - Configurable radius around airport
  - Returns total price and room availability for each hotel

### POST /cancelled-flights/:id/bookings/:bookingId/check-rate
- **Description**: Validate rate availability and pricing
- **Auth**: Airline user with EDIT access
- **Request**: `{ rateKey: string }`
- **Response**: Re-validated rate details, cancellation policies
- **Features**: Must be done before booking to ensure rate is still available

### POST /cancelled-flights/:id/bookings/:bookingId/book-hotel
- **Description**: **START MANUAL HOTEL RESERVATION**
- **HTTP Status**: 202 Accepted (runs in background)
- **Auth**: Airline user with EDIT access
- **Core Functionality**:
  - Records booking attempt (PNR shows as in_progress)
  - Returns immediately (202)
  - **Background Process**:
    - Re-validates rates with supplier
    - Performs live booking with supplier
    - Updates hotel booking status
    - Charges cost to airline wallet on success
  - **Applicable For**:
    - Flights with status: allocated, paid, or published
    - PNRs that allocation run could not place

---

## 4. **Hotel Information & Search APIs**

### GET /api/v1/hotel-availability
- **Description**: Search live hotel availability near airport
- **Auth**: Platform user with HOTELS VIEW access
- **Request Parameters**:
  - `airportId`: Airport code
  - `checkInDate`: YYYY-MM-DD
  - `checkOutDate`: YYYY-MM-DD
  - `rooms`: JSON array `[{"adults":2,"childrenAges":[7]}]`
  - `radius`: 1-70 km (default from config)
  - `residency`: Country code (optional, defaults to airport country)
- **Response**: Available hotels sorted by distance, then price
- **Features**:
  - Live supplier search (1 call per search)
  - 1 room = 1 search; 2-9 rooms = multiroom search
  - No booking, only read
  - Max 30 nights stay

### GET /api/v1/hotel-providers
- **Description**: List available hotel suppliers
- **Auth**: Platform user only
- **Response**: All configured suppliers with active/configured status
- **Features**:
  - Used for hotel bookings provider filter
  - Shows only suppliers with active credentials

### GET /cancelled-flights/:id/hotels/:hotelCode
- **Description**: Get static hotel profile details
- **Auth**: Airline user with VIEW access
- **Response**: Hotel details including:
  - Name, stars, address, contact, coordinates
  - Distance from airport
  - Images, website
  - Amenities and policies (check-in/out times)
- **Features**: Read from stored hotel content, no availability search

---

## 5. **Hotel Recommendations & Preview APIs**

### POST /cancelled-flights/:id/hotel-recommendations
- **Description**: Generate hotel recommendations for all PNRs
- **Auth**: Airline user with VIEW access
- **Response**: Recommended allocations without creating bookings
- **Features**:
  - Builds room occupancies per booking
  - Single supplier availability search
  - Returns preferred and fallback options
  - Read-only (no booking)

### GET /cancelled-flights/:id/plan-preview/recommendation
- **Description**: Preview what allocation run would book
- **Auth**: Airline or Platform user with VIEW access
- **Response**: Exact hotels the allocation run would choose per PNR
- **Features**:
  - Shows ranking: most stars first → cheapest within same star
  - Classes in booking order (First → Economy)
  - `recommended` field shows which hotel would be booked
  - Read-only, calls supplier live

### POST /cancelled-flights/plan-preview/hotels
- **Description**: Geo-based hotel search near airport
- **Auth**: Airline or Platform user with VIEW access
- **Request**: Stay dates, airport, residency, party composition, room split, radius
- **Response**: All hotels found, sorted by distance
- **Features**:
  - No supply buffer, no star filter
  - Includes closed hotels (active: false)
  - Single supplier search
  - Read-only

### POST /cancelled-flights/plan-preview/splits
- **Description**: Parallel hotel searches per room split
- **HTTP Status**: 202 Accepted (runs in background)
- **Auth**: Airline or Platform user with VIEW access
- **Response**: `requestId` to track progress
- **Features**:
  - `need=all`: Every hotel found per split
  - `need=recommend`: Best hotels for ceil(allocation × BUFFER_RATIO)
  - Results kept for 5 days
  - Read-only

### GET /cancelled-flights/plan-preview/splits/:requestId
- **Description**: Read split preview results
- **Auth**: Airline or Platform user with VIEW access
- **Response**: 
  - `status`: RUNNING / COMPLETED / FAILED
  - `result`: Hotels per split
  - `error`: Error message if failed
- **Features**: 404 if older than 5 days or other airline's

---

## 6. **Supporting Booking APIs**

### POST /cancelled-flights/:id/bookings
- **Description**: Create a new passenger booking (PNR)
- **Auth**: Airline user with EDIT access
- **Request**: Booking details (PNR, passenger info, segment info)
- **Response**: Created booking with ID

### POST /cancelled-flights/:id/bookings/import
- **Description**: Bulk import bookings from CSV
- **Auth**: Airline user with EDIT access
- **Request**: CSV file with booking data
- **Response**: Import summary with success/failure counts

### PATCH /cancelled-flights/:id/bookings/:bookingId
- **Description**: Update booking details
- **Auth**: Airline user with EDIT access
- **Features**: All fields optional, PNR uniqueness re-validated

### DELETE /cancelled-flights/:id/bookings/:bookingId
- **Description**: Delete a booking
- **Auth**: Airline user with VIEW + EDIT access
- **Features**: Hard delete

### POST /cancelled-flights/:id/bookings/confirm
- **Description**: Confirm all passenger booking details
- **Auth**: Airline user with EDIT access
- **Features**: Moves flight status to PASSENGERS_BOOKING_CONFIRMED

---

## 7. **Hotel Supplier Webhooks**

### POST /api/v1/hotel-suppliers/ratehawk/booking-status
- **Description**: Webhook for RateHawk booking status updates
- **Auth**: None (webhook from supplier)
- **Features**:
  - Receives real-time booking confirmations/cancellations from RateHawk
  - Updates hotel booking status in real-time
  - Triggers payment processing

---

## 8. **Flight & Payment APIs**

### POST /cancelled-flights/:id/payment
- **Description**: Process flight payment
- **Auth**: Airline user with EDIT access
- **Features**: 
  - **DISABLED by default** (FLIGHT_PAYMENT_STEP_ENABLED = false)
  - Hotels are charged to wallet as each PNR is booked (asynchronous)
  - When enabled, processes payment after allocation

### POST /cancelled-flights/:id/publish
- **Description**: Publish flight to passengers
- **Auth**: Airline user with EDIT access
- **Features**:
  - Flight must have all PNRs booked
  - Sends notification email to all passengers
  - Makes confirmations visible to passengers

### GET /cancelled-flights/:id/report
- **Description**: Download hotel allocation invoice
- **Auth**: Airline user with EXPORT access
- **Response**: PDF with:
  - Every PNR's hotel allocation (contact, passengers, hotel, rating, rooms, cost)
  - Cost summary
- **Features**: Available once flight is allocated, paid, or published

---

## Flight Status Flow

```
DRAFT → PASSENGERS_BOOKING_CONFIRMED → ALLOCATED (or PAID) → PUBLISHED
                                           ↓
                                   [Hotel Bookings]
                                           ↓
                                      (Payment)
```

### Key Statuses:
1. **DRAFT**: Flights created, bookings being added
2. **PASSENGERS_BOOKING_CONFIRMED**: All passenger details confirmed, ready for hotel allocation
3. **ALLOCATED**: Hotel allocation complete, PNRs booked (or failed)
4. **PAID**: (Optional step, usually skipped) Payment processed
5. **PUBLISHED**: Flight published to passengers

---

## Hotel Booking Status Flow

```
in_progress → confirmed (success)
           → manual_check (unknown outcome)
           → failed (can retry)
```

---

## Supplier Integration

### Configured Suppliers:
1. **RateHawk** - Primary provider
2. **HotelBeds** - Alternative provider

### Live Operations:
- Availability searches are live (call supplier directly)
- Bookings are live (supplier creates actual reservations)
- Rates are validated before each booking
- Webhooks receive real-time updates

---

## Key Business Rules

1. **Automatic Allocation** (`POST /hotel-allocations`):
   - Runs for entire flight's PNRs at once
   - Idempotent: safe to retry
   - Runs in background (202 Accepted)
   - Charges cost to airline wallet automatically

2. **Manual Booking** (`POST /bookings/:bookingId/book-hotel`):
   - For specific PNRs only
   - Requires rate validation first (`check-rate`)
   - Also charges to wallet
   - Runs in background (202 Accepted)

3. **Pricing**:
   - Net supplier price shown in searches
   - Platform fee added for confirmation
   - Supplier margin calculated for platform revenue
   - Airline charged full amount (net + platform fees)

4. **Charge Timing**:
   - Charged when: PNR booking confirmed with supplier
   - Charged to: Airline wallet
   - Amount: Net hotel cost + platform fees

5. **Email & Notifications**:
   - Confirmation email: `POST /hotel-bookings/:id/send` (airline-triggered)
   - Notification to passenger: Automatic at flight publish
   - PDF confirmation: `GET /hotel-bookings/:id/confirmation`

---

## Testing/Preview APIs

These are read-only endpoints for testing without creating actual bookings:

- `POST /cancelled-flights/:id/hotel-recommendations` - See recommendations
- `GET /cancelled-flights/:id/plan-preview/recommendation` - Preview exact allocation
- `POST /cancelled-flights/plan-preview/hotels` - Test availability search
- `POST /cancelled-flights/plan-preview/splits` - Parallel test searches
- `GET /cancelled-flights/plan-preview/splits/:requestId` - Read test results

---

## Summary

**Where actual hotel bookings happen:**

1. **Primary**: `POST /api/v1/cancelled-flights/:id/hotel-allocations` (automatic, all PNRs)
2. **Secondary**: `POST /api/v1/cancelled-flights/:id/bookings/:bookingId/book-hotel` (manual, specific PNR)
3. **Tracking**: `GET /api/v1/cancelled-flights/:id/hotel-allocations` (status & results)
4. **Confirmation**: `GET /api/v1/hotel-bookings/:id` (view booked details)

All bookings are live with hotel suppliers, charge the airline wallet, and can be tracked via hotel booking IDs.
