# Actual Booking Feature - Flow Diagram

## Decision Flow

```
User calls booking API
       |
       v
┌──────────────────────────┐
│ Read ACTUAL_BOOKING_      │
│ ENABLED from config       │
└──────────────────────────┘
       |
       v
    Is it
    "true"?
    /      \
   /        \
  /          \
YES          NO
 |            |
 |            v
 |      ┌─────────────────────────────┐
 |      │ Throw ServiceUnavailableEx. │
 |      │ (HTTP 503)                  │
 |      │                             │
 |      │ Message:                    │
 |      │ "Hotel booking is not       │
 |      │  enabled on this server"    │
 |      └─────────────────────────────┘
 |            |
 |            v
 |      Return to client
 |      {
 |        statusCode: 503,
 |        message: "...",
 |        error: "Service Unavailable"
 |      }
 |
 v
Check other validations
(auth, flight exists, etc.)
 |
 v
All valid?
 /         \
/           \
YES         NO
|            |
v            v
Proceed   Return error
to booking (400/404/409)
|
v
Make live API call
to hotel supplier
|
v
Return 202 Accepted
{
  success: true,
  data: {
    running: true,
    ...
  }
}
```

## Protected Endpoints - Decision Tree

```
REQUEST
  |
  +---> POST /cancelled-flights/:id/hotel-allocations
  |       |
  |       +---> Check ACTUAL_BOOKING_ENABLED
  |             |
  |             +---> FALSE ---> 503 Service Unavailable
  |             |
  |             +---> TRUE ----> Proceed with allocation
  |
  +---> POST /cancelled-flights/:id/bookings/:bookingId/book-hotel
  |       |
  |       +---> Check ACTUAL_BOOKING_ENABLED
  |             |
  |             +---> FALSE ---> 503 Service Unavailable
  |             |
  |             +---> TRUE ----> Proceed with manual booking
  |
  +---> GET /hotel-bookings/* (Read-only)
  |       |
  |       +---> ✅ Always works (no booking check needed)
  |
  +---> GET /hotel-availability (Search, no booking)
  |       |
  |       +---> ✅ Always works (read-only)
  |
  +---> POST /check-rate (Validation only)
          |
          +---> ✅ Always works (doesn't create booking)
```

## Configuration Scenarios

### Scenario 1: Development (Safe Default)

```
Environment:  .env.local or .env.dev
Configuration: ACTUAL_BOOKING_ENABLED=false

User tries to book
       |
       v
┌────────────────────────────────┐
│ Hotel Allocation API           │
│ POST /hotel-allocations        │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Check config.hotelBooking.     │
│ enabled = false                │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Throw ServiceUnavailableEx     │
│ HTTP 503                       │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────────────────────┐
│ Client receives:                               │
│ {                                              │
│   "statusCode": 503,                           │
│   "message": "Hotel booking is not enabled..." │
│ }                                              │
│                                                │
│ Developer sees clear message                   │
│ ❌ No real bookings created                    │
│ ✅ Safe to develop/test                       │
└────────────────────────────────────────────────┘
```

### Scenario 2: Staging (Sandbox Mode)

```
Environment:  .env.dev
Configuration: 
  ACTUAL_BOOKING_ENABLED=true
  HOTEL_USE_SANDBOX=true
  RATEHAWK_API_KEY=sandbox-key

User tries to book
       |
       v
┌────────────────────────────────┐
│ Hotel Allocation API           │
│ POST /hotel-allocations        │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Check config.hotelBooking.     │
│ enabled = true ✅              │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Validate flight & bookings     │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Call RateHawk Sandbox API      │
│ (not real charges)             │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────────────────────┐
│ Client receives:                               │
│ {                                              │
│   "statusCode": 202,                           │
│   "data": {                                    │
│     "running": true,                           │
│     "pnrStatuses": { ... }                     │
│   }                                            │
│ }                                              │
│                                                │
│ ✅ Booking runs in background                │
│ ✅ Sandbox = no real charges                  │
│ ✅ Can test allocation flow                   │
└────────────────────────────────────────────────┘
```

### Scenario 3: Production (Live Bookings)

```
Environment:  .env.prod
Configuration:
  ACTUAL_BOOKING_ENABLED=true ⚠️ PRODUCTION
  HOTEL_USE_SANDBOX=false
  RATEHAWK_API_KEY=live-key
  RATEHAWK_USER_ID=live-id

User tries to book
       |
       v
┌────────────────────────────────┐
│ Hotel Allocation API           │
│ POST /hotel-allocations        │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Check config.hotelBooking.     │
│ enabled = true ✅              │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Validate flight & bookings     │
│ Check airline wallet balance   │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Call RateHawk LIVE API         │
│ (creates real reservations)    │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────┐
│ Charge airline wallet          │
│ Store booking reference        │
└────────────────────────────────┘
       |
       v
┌────────────────────────────────────────────────┐
│ Client receives:                               │
│ {                                              │
│   "statusCode": 202,                           │
│   "data": {                                    │
│     "running": true,                           │
│     "pnrStatuses": { ... }                     │
│   }                                            │
│ }                                              │
│                                                │
│ ⚠️ REAL BOOKINGS IN PROGRESS                 │
│ ⚠️ MONEY BEING CHARGED                        │
│ ✅ Passenger receives confirmation email       │
└────────────────────────────────────────────────┘
```

## API Lifecycle by Configuration

```
┌─────────────────────────────────────────────────────────┐
│                   ACTUAL_BOOKING_ENABLED                │
├─────────────────────────────────────────────────────────┤
│                    FALSE (Default)                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  API Call:  POST /hotel-allocations                   │
│  Response:  HTTP 503 Service Unavailable              │
│  Message:   "Hotel booking is not enabled..."         │
│  Booking:   ❌ NOT CREATED                            │
│  Charge:    ❌ NO CHARGE TO WALLET                    │
│  Side Effects: ❌ NONE (Safe)                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                     TRUE                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  API Call:  POST /hotel-allocations                   │
│  Response:  HTTP 202 Accepted                         │
│  Message:   "Hotel allocation started"                │
│  Booking:   ✅ CREATED (via supplier API)             │
│  Charge:    ✅ CHARGED TO WALLET                      │
│  Side Effects:                                         │
│    - Email sent to passenger                          │
│    - Database updated                                 │
│    - Supplier notified                                │
│    - Webhook handlers triggered                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Configuration Change Impact

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│   Initial State      │  After Change        │   Behavior           │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ ENABLED=false        │ ENABLED=true         │  Next API call       │
│ (safe)               │ (production)         │  will create booking │
│                      │                      │  ⚠️ Restart app      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ ENABLED=true         │ ENABLED=false        │  Next API call       │
│ (live bookings)      │ (safe)               │  will return 503     │
│                      │                      │  ⚠️ Restart app      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ ENABLED=true         │ ENABLED=true         │  No change           │
│ (live bookings)      │ SANDBOX=true         │  Live → Sandbox      │
│                      │                      │  ✅ No restart       │
└──────────────────────┴──────────────────────┴──────────────────────┘
```

## Configuration Precedence

```
Environment Variable Hierarchy:
(Listed in order of precedence)

1. .env.automation_test  (automated tests)
   ACTUAL_BOOKING_ENABLED=false

2. .env.local            (your machine)
   ACTUAL_BOOKING_ENABLED=false

3. .env.test             (unit tests)
   ACTUAL_BOOKING_ENABLED=false

4. .env.dev              (dev server)
   ACTUAL_BOOKING_ENABLED=false

5. .env.prod             (production)
   ACTUAL_BOOKING_ENABLED=true

6. .env.example          (template)
   ACTUAL_BOOKING_ENABLED=false
```

## Safety Checklist Before Production

```
Before deploying with ACTUAL_BOOKING_ENABLED=true:

□ Hotel Provider Credentials
  □ RATEHAWK_API_KEY set and valid
  □ RATEHAWK_USER_ID set and valid
  □ OR HOTELBEDS_API_KEY and HOTELBEDS_SECRET set

□ Email Configuration
  □ BOOKING_CONFIRMATION_EMAIL set
  □ AWS SES credentials configured
  □ FROM email verified in AWS SES

□ Airline Wallet
  □ Airline has sufficient credits
  □ Payment method configured
  □ Wallet audit log enabled

□ Database
  □ Migrations run
  □ Hotel tables populated
  □ Connections tested

□ Logging
  □ LOG_LEVEL=info or higher
  □ Audit logs enabled
  □ Error alerting configured

□ Testing
  □ Sandbox test completed
  □ Sample booking tested
  □ Email confirmation received

□ Monitoring
  □ Booking metrics dashboard ready
  □ Error rate alerting configured
  □ Success rate tracking enabled
```
