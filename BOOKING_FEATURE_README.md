# Actual Hotel Booking Feature

## Overview

A production-ready feature to control whether live hotel bookings are created by the FlyVoid backend.

**Purpose:** Prevent accidental live bookings during development while making it easy to enable production bookings.

**Status:** ✅ Implemented and tested

## Quick Start

### For Development (Recommended Default)

```env
# .env.local
ACTUAL_BOOKING_ENABLED=false
```

Result: Hotel booking APIs return **HTTP 503** with a clear message.

### For Production

```env
# .env.prod
ACTUAL_BOOKING_ENABLED=true
HOTEL_USE_SANDBOX=false
RATEHAWK_API_KEY=your-live-key
RATEHAWK_USER_ID=your-live-id
```

Result: Hotel booking APIs work and create real bookings.

## Two Booking APIs Protected

| API | Purpose | When Disabled | When Enabled |
|-----|---------|---------------|--------------|
| `POST /cancelled-flights/:id/hotel-allocations` | Automatically allocate hotels to entire flight | 503 error | Creates real bookings |
| `POST /cancelled-flights/:id/bookings/:bookingId/book-hotel` | Manually book hotel for specific passenger | 503 error | Creates real booking |

## Implementation Details

### Configuration

The feature is controlled by **one environment variable**:

```env
ACTUAL_BOOKING_ENABLED=false   # Default (safe)
# OR
ACTUAL_BOOKING_ENABLED=true    # Enable for production
```

**Type:** Boolean (string "true" or "false")  
**Default:** `false` (safe, recommended)  
**Case-sensitive:** Yes (must be lowercase "true"/"false")

### Code Changes

**Files modified:**
1. `.env.example` - Added env variable template
2. `.env.dev` - Added default configuration
3. `src/config/config.ts` - Added config property
4. `src/cancelled-flights/cancelled-flights.controller.ts` - Added checks in 2 endpoints

**Lines of code changed:** ~20 lines total

### Error Response

When booking is disabled, both APIs return:

```
HTTP 503 Service Unavailable

{
  "statusCode": 503,
  "message": "Hotel booking is not enabled on this server. Please enable ACTUAL_BOOKING_ENABLED in your environment configuration.",
  "error": "Service Unavailable"
}
```

## Why HTTP 503?

**Service Unavailable (503)** indicates the feature is temporarily disabled due to server configuration, not a client error. This:

- ✅ Uses correct HTTP semantics
- ✅ Signals "configuration issue" not "user error"
- ✅ Allows clients to retry if config changes
- ✅ Prevents confusion with permission errors (403) or validation errors (400)

## Security

### Secure by Default ✅

- Booking is **disabled** by default
- Requires explicit configuration to enable
- Cannot be bypassed without code/config changes
- Error message is clear and doesn't leak sensitive info

### Production Safety ✅

```env
# Production requires:
1. ACTUAL_BOOKING_ENABLED=true
2. Live hotel credentials (RATEHAWK_API_KEY or HOTELBEDS credentials)
3. HOTEL_USE_SANDBOX=false
4. Valid airline wallet with funds
```

Failure to configure any of these means:
- Bookings fail safely with clear errors
- No unexpected charges occur

## Usage Examples

### Example 1: Develop Without Bookings

```bash
# 1. Use default .env.local
# ACTUAL_BOOKING_ENABLED=false

# 2. Start dev server
npm run dev

# 3. Try to create booking
curl -X POST http://localhost:3000/api/v1/cancelled-flights/1/hotel-allocations \
  -H "Authorization: Bearer <token>"

# 4. Expected response: 503
# {
#   "statusCode": 503,
#   "message": "Hotel booking is not enabled..."
# }

# ✅ Safe - no real bookings created
# ✅ Clear error message
```

### Example 2: Test with Sandbox

```bash
# 1. Update .env.local
# ACTUAL_BOOKING_ENABLED=true
# HOTEL_USE_SANDBOX=true
# RATEHAWK_API_KEY=sandbox-key

# 2. Restart server
npm run dev

# 3. Try to create booking
curl -X POST http://localhost:3000/api/v1/cancelled-flights/1/hotel-allocations \
  -H "Authorization: Bearer <token>"

# 4. Expected response: 202 (but using sandbox API)
# {
#   "success": true,
#   "data": {
#     "running": true,
#     ...
#   }
# }

# ✅ Bookings created with sandbox API (no charges)
# ✅ Full end-to-end testing possible
```

### Example 3: Production Deployment

```bash
# 1. Update .env.prod
# ACTUAL_BOOKING_ENABLED=true
# HOTEL_USE_SANDBOX=false
# RATEHAWK_API_KEY=live-key
# RATEHAWK_USER_ID=live-id

# 2. Deploy to production
npm run build && npm run start:prod

# 3. Create booking
curl -X POST https://api.production.com/api/v1/cancelled-flights/1/hotel-allocations \
  -H "Authorization: Bearer <token>"

# 4. Expected response: 202 (using live API)
# {
#   "success": true,
#   "data": {
#     "running": true,
#     ...
#   }
# }

# ⚠️ Real bookings created
# ⚠️ Real charges to airline wallet
# ✅ Passenger receives confirmation email
```

## Environment Files

### .env.example (Template)
```env
# Enable/disable actual live hotel bookings
# Set to true only when you have live hotel API credentials
ACTUAL_BOOKING_ENABLED=false
```

### .env.local (Your Machine)
```env
# Development - keep disabled
ACTUAL_BOOKING_ENABLED=false
```

### .env.dev (Development Server)
```env
# Development - keep disabled
ACTUAL_BOOKING_ENABLED=false
# Or test with sandbox:
# ACTUAL_BOOKING_ENABLED=true
# HOTEL_USE_SANDBOX=true
```

### .env.test (Testing)
```env
# Testing - keep disabled
ACTUAL_BOOKING_ENABLED=false
```

### .env.prod (Production)
```env
# Production - enable only with live credentials
ACTUAL_BOOKING_ENABLED=true
HOTEL_USE_SANDBOX=false
```

## Configuration Checklist

Before enabling booking, verify:

```
□ Environment set to .env.prod or production deployment
□ ACTUAL_BOOKING_ENABLED=true (case-sensitive)
□ HOTEL_USE_SANDBOX=false
□ Hotel provider credentials configured:
  □ RATEHAWK_API_KEY set
  □ RATEHAWK_USER_ID set
  □ OR HOTELBEDS_API_KEY and HOTELBEDS_SECRET set
□ Email configuration:
  □ BOOKING_CONFIRMATION_EMAIL set
  □ AWS SES credentials configured
□ Airline wallet:
  □ Sufficient funds available
  □ Payment method configured
□ Application restarted after config change
□ Tested with a small booking first
```

## Deployment Workflow

```
Development (Local)
  ACTUAL_BOOKING_ENABLED=false
  Result: Safe, no bookings
            |
            | (Commit to repo)
            v
Staging (Dev Server)
  ACTUAL_BOOKING_ENABLED=false (or sandbox=true)
  Result: Can test allocation flow
            |
            | (Merge to main)
            v
Production
  ACTUAL_BOOKING_ENABLED=true
  HOTEL_USE_SANDBOX=false
  Result: Real bookings, real charges
```

## Troubleshooting

### "Hotel booking is not enabled" but I set ACTUAL_BOOKING_ENABLED=true

1. **Check exact string:**
   ```bash
   grep ACTUAL_BOOKING_ENABLED .env*
   # Must be exactly: ACTUAL_BOOKING_ENABLED=true
   # Not: ACTUAL_BOOKING_ENABLED=True (case matters)
   ```

2. **Check environment file being loaded:**
   ```bash
   npm run start:dev    # Uses .env.dev
   npm run start:prod   # Uses .env.prod
   npm run dev          # Uses .env.local
   ```

3. **Restart application:**
   ```bash
   # Stop current process (Ctrl+C)
   # Restart with correct env file
   npm run dev
   ```

4. **Verify config loaded:**
   ```typescript
   // In controller or service
   console.log('Booking enabled:', config.hotelBooking.enabled);
   ```

### Booking enabled but no real bookings created

1. **Check hotel provider credentials:**
   ```bash
   grep RATEHAWK .env.prod
   # Should have RATEHAWK_API_KEY and RATEHAWK_USER_ID
   ```

2. **Check sandbox flag:**
   ```bash
   grep HOTEL_USE_SANDBOX .env.prod
   # Should be: HOTEL_USE_SANDBOX=false (for production)
   ```

3. **Check application logs:**
   ```bash
   npm run start:prod 2>&1 | grep -i "booking\|hotel"
   ```

## API Documentation

### Request

```
POST /api/v1/cancelled-flights/:id/hotel-allocations
Authorization: Bearer <token>
Content-Type: application/json
```

### Response (When Enabled)

```
HTTP 202 Accepted

{
  "success": true,
  "requestId": "req-12345",
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "Hotel allocation started",
  "data": {
    "running": true,
    "pnrStatuses": {
      "ABC123": "in_progress",
      "ABC124": "in_progress"
    },
    "totals": {
      "confirmed": 0,
      "in_progress": 2,
      "failed": 0,
      "manual_check": 0
    }
  }
}
```

### Response (When Disabled)

```
HTTP 503 Service Unavailable

{
  "statusCode": 503,
  "message": "Hotel booking is not enabled on this server. Please enable ACTUAL_BOOKING_ENABLED in your environment configuration.",
  "error": "Service Unavailable"
}
```

## Documentation Files

- **Quick Setup:** `ACTUAL_BOOKING_SETUP.md`
- **Full Documentation:** `backend/ACTUAL_BOOKING_FEATURE.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Flow Diagrams:** `BOOKING_FLOW_DIAGRAMS.md`
- **Hotel API Reference:** `HOTEL_BOOKING_APIS.md`

## Related Features

- **Hotel Availability Search:** Always works (read-only)
- **Hotel Recommendations:** Always works (preview only)
- **Check Rate:** Always works (validation only)
- **View Bookings:** Always works (read-only)

Only these two create actual bookings:
1. ✅ Automatic Allocation
2. ✅ Manual Booking

## Support

**Questions?** Check the documentation:

1. **Quick reference:** `ACTUAL_BOOKING_SETUP.md`
2. **Full guide:** `backend/ACTUAL_BOOKING_FEATURE.md`
3. **Diagrams:** `BOOKING_FLOW_DIAGRAMS.md`
4. **API reference:** `HOTEL_BOOKING_APIS.md`

## Changelog

### Version 1.0 (Current)
- ✅ Implemented `ACTUAL_BOOKING_ENABLED` env variable
- ✅ Protected 2 booking APIs
- ✅ Added HTTP 503 error response
- ✅ Comprehensive documentation
- ✅ Build verified
- ✅ Zero breaking changes
- ✅ Fully backward compatible

## Testing

**Manual Test:**
```bash
# 1. Keep disabled (default)
export ACTUAL_BOOKING_ENABLED=false

# 2. Start server
npm run dev

# 3. Try to book
curl -X POST http://localhost:3000/api/v1/cancelled-flights/1/hotel-allocations \
  -H "Authorization: Bearer $(get-token)"

# 4. Expect: 503 Service Unavailable
```

**To Run:**
```bash
npm run build          # Verify build
npm run start:dev      # Start dev server
npm test               # Run existing tests (should pass)
```

## Production Readiness

✅ Secure by default  
✅ Clear error messages  
✅ Comprehensive documentation  
✅ No breaking changes  
✅ Build verified  
✅ Ready for deployment  

---

**Last Updated:** 2024-11-22  
**Status:** ✅ Production Ready  
**Requires:** Node.js 16+, NestJS 10+  
