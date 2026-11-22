# Actual Booking Feature - Environment Control

## Overview

The `ACTUAL_BOOKING_ENABLED` environment variable controls whether live hotel bookings are created by the FlyVoid backend. This feature is designed for safety and allows you to:

- **Develop/Test without creating real bookings** (default: `false`)
- **Enable live bookings** only when you have live API credentials configured (`true`)
- **Prevent accidental bookings** in development/staging environments

## Environment Variable

**Name:** `ACTUAL_BOOKING_ENABLED`  
**Type:** Boolean  
**Default:** `false` (safe, recommended)  
**Valid Values:** `true` or `false`

## Configuration

### .env.example (Template)
```env
# Enable/disable actual live hotel bookings (POST to /hotel-allocations and /book-hotel)
# Set to true only when you have live hotel API credentials configured
# Default: false (safe, no live bookings will be created)
ACTUAL_BOOKING_ENABLED=false
```

### .env.dev (Development)
```env
ACTUAL_BOOKING_ENABLED=false
```

### .env.prod (Production)
```env
# Set to true ONLY when you have live credentials and want to process real bookings
ACTUAL_BOOKING_ENABLED=true
```

### .env.test (Testing)
```env
ACTUAL_BOOKING_ENABLED=false
```

### .env.local (Your Local Machine)
```env
# Keep this false to avoid accidental live bookings during development
ACTUAL_BOOKING_ENABLED=false
```

## Implementation Details

### Affected APIs

When `ACTUAL_BOOKING_ENABLED=false`, these two APIs throw **HTTP 503 Service Unavailable** error:

1. **`POST /api/v1/cancelled-flights/:id/hotel-allocations`**
   - Automatic hotel allocation for entire flight
   - Response: 503 Service Unavailable

2. **`POST /api/v1/cancelled-flights/:id/bookings/:bookingId/book-hotel`**
   - Manual hotel booking for specific passenger
   - Response: 503 Service Unavailable

### Error Response

When booking is disabled, both APIs return:

```json
{
  "statusCode": 503,
  "message": "Hotel booking is not enabled on this server. Please enable ACTUAL_BOOKING_ENABLED in your environment configuration.",
  "error": "Service Unavailable"
}
```

### Code Implementation

**File:** `backend/src/config/config.ts`
```typescript
hotelBooking: {
  enabled: process.env.ACTUAL_BOOKING_ENABLED === "true",
  // ... other config
}
```

**File:** `backend/src/cancelled-flights/cancelled-flights.controller.ts`
```typescript
import { config } from "../config/config";
import { ServiceUnavailableException } from "@nestjs/common";

// In both endpoints:
if (!config.hotelBooking.enabled) {
  throw new ServiceUnavailableException(
    "Hotel booking is not enabled on this server. Please enable ACTUAL_BOOKING_ENABLED in your environment configuration.",
  );
}
```

## Security Considerations

### Why Service Unavailable (503)?

Using **HTTP 503** instead of 400/403 indicates the feature is temporarily unavailable due to server configuration, not a client error. This ensures:

- Clear distinction from permission/validation errors
- Proper HTTP semantics (feature not available, not user error)
- Clients can implement exponential backoff if needed
- Developers understand it's a configuration issue

### Best Practices

1. **Development Environment**
   ```bash
   ACTUAL_BOOKING_ENABLED=false  # Always keep false
   ```
   - No real bookings created
   - Safe for testing
   - APIs return clear error message

2. **Staging Environment**
   ```bash
   ACTUAL_BOOKING_ENABLED=false  # Keep false
   HOTEL_USE_SANDBOX=true        # Use sandbox API if available
   ```
   - Use sandbox mode for supplier APIs
   - Builds with real credentials but no live bookings

3. **Production Environment**
   ```bash
   ACTUAL_BOOKING_ENABLED=true   # Enable only in production
   HOTEL_USE_SANDBOX=false       # Use live APIs
   # Ensure live credentials are configured:
   RATEHAWK_API_KEY=xxxxx
   RATEHAWK_USER_ID=xxxxx
   # OR
   HOTELBEDS_API_KEY=xxxxx
   HOTELBEDS_SECRET=xxxxx
   ```

## Setup Checklist

### Before Enabling Booking (`ACTUAL_BOOKING_ENABLED=true`)

- [ ] Hotel provider credentials are set:
  - [ ] `RATEHAWK_API_KEY` and `RATEHAWK_USER_ID` (if using RateHawk)
  - [ ] `HOTELBEDS_API_KEY` and `HOTELBEDS_SECRET` (if using HotelBeds)

- [ ] Hotel provider is configured:
  - [ ] `HOTEL_PROVIDER` set to `ratehawk` or `hotelbeds`
  - [ ] `HOTEL_USE_SANDBOX=false` for production

- [ ] Airline wallet is funded:
  - [ ] Airline has sufficient credits to pay for bookings
  - [ ] Payment method configured

- [ ] Email is configured:
  - [ ] `BOOKING_CONFIRMATION_EMAIL` set
  - [ ] AWS SES credentials configured (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

- [ ] Logging is enabled:
  - [ ] `LOG_LEVEL=info` or higher for audit trail

### Testing the Feature

#### 1. Test with Booking Disabled
```bash
# In .env.local or .env.dev
ACTUAL_BOOKING_ENABLED=false

# Try to create a booking
curl -X POST http://localhost:3000/api/v1/cancelled-flights/123/hotel-allocations \
  -H "Authorization: Bearer <token>"

# Expected response (503):
# {
#   "statusCode": 503,
#   "message": "Hotel booking is not enabled on this server. ..."
# }
```

#### 2. Test with Booking Enabled (Sandbox Mode)
```bash
# In .env.local
ACTUAL_BOOKING_ENABLED=true
HOTEL_PROVIDER=ratehawk
HOTEL_USE_SANDBOX=true
RATEHAWK_API_KEY=<sandbox-key>
RATEHAWK_USER_ID=<sandbox-id>

# Try to create a booking
curl -X POST http://localhost:3000/api/v1/cancelled-flights/123/hotel-allocations \
  -H "Authorization: Bearer <token>"

# Expected response (202):
# {
#   "success": true,
#   "data": { "running": true, ... }
# }
```

## Troubleshooting

### "Hotel booking is not enabled" but I set it to true

1. Check the environment file:
   ```bash
   grep ACTUAL_BOOKING_ENABLED .env*
   ```

2. Ensure exact string match:
   ```bash
   # Correct:
   ACTUAL_BOOKING_ENABLED=true
   
   # Wrong (not recognized):
   ACTUAL_BOOKING_ENABLED=True
   ACTUAL_BOOKING_ENABLED=TRUE
   ACTUAL_BOOKING_ENABLED=yes
   ```

3. Reload the application:
   ```bash
   npm run dev    # Uses .env.local
   npm run start:dev    # Uses .env.dev
   npm run start:prod   # Uses .env.prod
   ```

4. Check which env file is being loaded:
   ```bash
   cat backend/.env.dev | grep ACTUAL_BOOKING_ENABLED
   ```

### Booking enabled but credentials not working

1. Verify provider credentials:
   ```bash
   # For RateHawk:
   grep -E "RATEHAWK_API_KEY|RATEHAWK_USER_ID" .env*
   
   # For HotelBeds:
   grep -E "HOTELBEDS_API_KEY|HOTELBEDS_SECRET" .env*
   ```

2. Check provider is active:
   ```bash
   grep HOTEL_PROVIDER .env*
   ```

3. Test sandbox first:
   ```bash
   HOTEL_USE_SANDBOX=true
   # Then try booking
   ```

4. Check logs for API errors:
   ```bash
   npm run start:dev 2>&1 | grep -i "hotel\|booking\|error"
   ```

## Migration Path

### From Disabled to Enabled

1. Start with `ACTUAL_BOOKING_ENABLED=false` (safe default)
2. Develop and test with mock data
3. Set up hotel provider credentials and test in sandbox
4. Enable booking in staging with sandbox mode:
   ```bash
   ACTUAL_BOOKING_ENABLED=true
   HOTEL_USE_SANDBOX=true
   ```
5. Test end-to-end with sandbox (bookings don't charge real money)
6. Deploy to production with live credentials:
   ```bash
   ACTUAL_BOOKING_ENABLED=true
   HOTEL_USE_SANDBOX=false
   ```

## Monitoring

### Logs to Monitor

When booking is enabled, watch for these log messages:

```
Starting hotel allocation for cancelled flight 123
Hotel allocation started
Hotel booking started
Booking confirmed with supplier
Payment charged to wallet: $XXX
```

### Metrics to Track

- Number of booking attempts
- Success rate (confirmed vs failed vs manual_check)
- Average booking time
- Supplier response times
- Error rates by supplier

## Support

For issues or questions:

1. Check logs: `backend/logs/`
2. Review the error message in API response
3. Verify `.env` file configuration
4. Consult hotel provider documentation for API errors
