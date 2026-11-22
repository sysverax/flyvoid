# Quick Setup: Actual Booking Feature

## What Changed?

Added `ACTUAL_BOOKING_ENABLED` environment variable to control whether the hotel booking APIs create real bookings.

## Two APIs Protected

1. ✅ `POST /api/v1/cancelled-flights/:id/hotel-allocations`
2. ✅ `POST /api/v1/cancelled-flights/:id/bookings/:bookingId/book-hotel`

## Default Behavior (Safe)

```env
ACTUAL_BOOKING_ENABLED=false  # Default
```

**Result:** Both APIs return **HTTP 503 Service Unavailable** with message:
```
Hotel booking is not enabled on this server. Please enable ACTUAL_BOOKING_ENABLED in your environment configuration.
```

## Enable Booking

```env
ACTUAL_BOOKING_ENABLED=true
```

**Result:** APIs work normally and create real bookings (charges airline wallet)

## Setup Checklist

- [ ] Update `.env.local`, `.env.dev`, `.env.test` with `ACTUAL_BOOKING_ENABLED=false`
- [ ] Update `.env.prod` with `ACTUAL_BOOKING_ENABLED=true`
- [ ] Verify hotel provider credentials when enabling for production
- [ ] Test with sandbox first: `HOTEL_USE_SANDBOX=true`
- [ ] Enable in production only: `HOTEL_USE_SANDBOX=false`

## Files Changed

| File | Change |
|------|--------|
| `.env.example` | Added `ACTUAL_BOOKING_ENABLED=false` |
| `.env.dev` | Added `ACTUAL_BOOKING_ENABLED=false` |
| `src/config/config.ts` | Added `enabled: process.env.ACTUAL_BOOKING_ENABLED === "true"` |
| `src/cancelled-flights/cancelled-flights.controller.ts` | Added checks in both booking endpoints |

## Test It

```bash
# 1. Keep disabled (default)
# In .env.local:
ACTUAL_BOOKING_ENABLED=false

# 2. Try to book
curl -X POST http://localhost:3000/api/v1/cancelled-flights/1/hotel-allocations \
  -H "Authorization: Bearer <token>"

# 3. Expected response: HTTP 503
# {
#   "statusCode": 503,
#   "message": "Hotel booking is not enabled on this server..."
# }

# 4. Enable and test
# Update .env.local:
ACTUAL_BOOKING_ENABLED=true

# 5. Restart: npm run dev

# 6. Try again - should work (or fail with real API error, not 503)
```

## Production Safety

| Environment | Setting | Sandbox | Result |
|---|---|---|---|
| Development | `false` | N/A | No real bookings, error on booking API |
| Staging | `false` | `true` | Sandbox bookings, preview only |
| Staging | `true` | `true` | Real bookings but sandbox API (no charge) |
| Production | `true` | `false` | Real bookings, real charges |

## Documentation

- **Full guide:** `backend/ACTUAL_BOOKING_FEATURE.md`
- **Hotel API reference:** `HOTEL_BOOKING_APIS.md`

## Need Help?

1. Check if `ACTUAL_BOOKING_ENABLED=true` (case-sensitive)
2. Verify hotel provider credentials are set
3. Check application logs for detailed errors
4. Review `ACTUAL_BOOKING_FEATURE.md` troubleshooting section
