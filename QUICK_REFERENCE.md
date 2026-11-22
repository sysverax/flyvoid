# Actual Hotel Booking Feature - Quick Reference

## One-Liner
Disable live hotel bookings with one environment variable: `ACTUAL_BOOKING_ENABLED=false` (default)

## Two Protected APIs

```
POST /cancelled-flights/:id/hotel-allocations
POST /cancelled-flights/:id/bookings/:bookingId/book-hotel
```

## Configuration

### Default (Safe) ✅
```env
ACTUAL_BOOKING_ENABLED=false
```
→ APIs return **HTTP 503**

### Production 
```env
ACTUAL_BOOKING_ENABLED=true
```
→ APIs create real bookings

## Error Response (When Disabled)

```
HTTP 503 Service Unavailable
"Hotel booking is not enabled on this server..."
```

## Testing

```bash
# Check it's disabled
curl -X POST http://localhost:3000/api/v1/cancelled-flights/1/hotel-allocations

# Expected: 503 Service Unavailable ✅
```

## Setup

| Environment | Setting | Behavior |
|---|---|---|
| `.env.local` (dev) | `false` | Safe ✅ |
| `.env.dev` (dev server) | `false` | Safe ✅ |
| `.env.prod` (production) | `true` | Live bookings ⚠️ |

## Before Enabling

1. ✅ Hotel credentials configured
2. ✅ Airline wallet has funds
3. ✅ Email is set up
4. ✅ Tested with sandbox first

## Why 503?

503 = Service Unavailable (feature disabled, not a user error)

✅ Correct HTTP semantics  
✅ Clear to developers  
✅ Different from 400 (validation) or 403 (permission)

## Files Changed

- `.env.example` - Added env var
- `.env.dev` - Added setting
- `src/config/config.ts` - 1 line added
- `src/cancelled-flights/cancelled-flights.controller.ts` - 20 lines added

## Documentation

- **Quick setup:** `ACTUAL_BOOKING_SETUP.md`
- **Full guide:** `BOOKING_FEATURE_README.md`
- **Diagrams:** `BOOKING_FLOW_DIAGRAMS.md`
- **API ref:** `HOTEL_BOOKING_APIS.md`

## Key Points

✅ Secure by default (disabled)  
✅ One environment variable  
✅ Clear error messages  
✅ No code changes needed  
✅ Zero breaking changes  
✅ Production ready  

---

**Status:** ✅ Implemented & Tested  
**Build:** ✅ Passing  
**Ready:** ✅ Production Deploy
