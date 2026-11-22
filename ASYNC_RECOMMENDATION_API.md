# Async Hotel Recommendation API - Implementation Guide

## 📋 Overview

This document describes the new async hotel recommendation API endpoints that allow you to request hotel allocation recommendations without timeout issues. The original synchronous API (GET `/cancelled-flights/:id/plan-preview/recommendation`) is still available but processes everything in one request, which can timeout for large allocations.

The new async pattern solves this by:
1. **Triggering** a background job that processes the recommendation
2. **Polling** the result until it completes
3. Returning the **exact same response format** as the synchronous API

---

## 🚀 Quick Start

### Step 1: Trigger a Recommendation Job

```bash
POST /api/v1/cancelled-flights/:flightId/plan-preview/recommendation/start
Authorization: Bearer <token>
```

**Response (202 Accepted immediately):**
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "PENDING",
  "message": "Job f47ac10b-58cc-4372-a567-0e02b2c3d479 started. Poll /plan-preview/recommendation/f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### Step 2: Poll for Results

```bash
GET /api/v1/cancelled-flights/plan-preview/recommendation/f47ac10b-58cc-4372-a567-0e02b2c3d479
Authorization: Bearer <token>
```

**Response (while PENDING):**
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "PENDING",
  "completedAt": null,
  "result": null
}
```

**Response (when COMPLETED):**
```json
{
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "COMPLETED",
  "completedAt": "2026-11-22T10:53:01.192Z",
  "result": {
    "success": true,
    "requestId": "original-request-id",
    "timestamp": "2026-11-22T10:53:01.192Z",
    "data": {
      "cancelledFlightId": 156,
      "flightNumber": "HTFS2E",
      "flightStatus": "passengers_booking_confirmed",
      "checkInDate": "2026-11-27",
      "checkOutDate": "2026-11-28",
      "departureAirport": "DXB",
      "supplyBufferRatio": 1.5,
      "totalPnrs": 10,
      "allocatedPnrs": 10,
      "unallocatedPnrs": 0,
      "allAllocated": true,
      "supplyPool": [...],
      "splits": [...]
    }
  }
}
```

---

## 📡 API Endpoints

### 1. POST `/cancelled-flights/:flightId/plan-preview/recommendation/start`

**Start an async recommendation job**

#### Parameters
- `flightId` (path, required): The cancelled flight ID

#### Response (202 Accepted)
```typescript
{
  jobId: string;           // UUID for tracking the job
  status: 'PENDING';       // Initial status
  message: string;         // Instructions with polling URL
}
```

#### Errors
- `400`: Invalid flight ID
- `401`: Unauthorized
- `403`: Access denied (not your airline's flight)
- `404`: Flight not found

#### Example
```bash
curl -X POST \
  https://api.example.com/api/v1/cancelled-flights/156/plan-preview/recommendation/start \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

---

### 2. GET `/cancelled-flights/plan-preview/recommendation/:jobId`

**Poll the result of a recommendation job**

#### Parameters
- `jobId` (path, required): The job ID returned by POST endpoint (UUID format)

#### Response (200 OK)
```typescript
{
  jobId: string;                                    // The job UUID
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  completedAt?: string;                             // ISO 8601 timestamp (null if not completed)
  result?: {                                        // Null while PENDING/PROCESSING
    success: boolean;
    requestId: string;
    timestamp: string;
    data: {
      cancelledFlightId: number;
      flightNumber: string;
      flightStatus: string;
      checkInDate: string;
      checkOutDate: string;
      departureAirport: string;
      supplyBufferRatio: number;
      totalPnrs: number;
      allocatedPnrs: number;
      unallocatedPnrs: number;
      allAllocated: boolean;
      supplyPool: Array<{...}>;
      splits: Array<{...}>;
    };
  };
  errorMessage?: string;                            // Set if status is FAILED
}
```

#### Status Values
- `PENDING`: Job created but not yet processing
- `PROCESSING`: Job actively processing
- `COMPLETED`: Job finished successfully
- `FAILED`: Job failed with error

#### Errors
- `401`: Unauthorized
- `404`: Job not found or expired (jobs expire after 7 days)

#### Example
```bash
curl -X GET \
  https://api.example.com/api/v1/cancelled-flights/plan-preview/recommendation/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Authorization: Bearer your-token"
```

---

## 💾 Database Schema

The recommendation jobs are stored in the `recommendation_jobs` table:

```sql
CREATE TABLE recommendation_jobs (
  id uuid PRIMARY KEY,
  flight_id integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  result jsonb,
  error_message text,
  expires_at timestamp NOT NULL,  -- 7 days from creation
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendation_jobs_expires_at ON recommendation_jobs(expires_at);
CREATE INDEX idx_recommendation_jobs_flight_id ON recommendation_jobs(flight_id);
CREATE INDEX idx_recommendation_jobs_status ON recommendation_jobs(status);
```

---

## 🔄 Processing Flow

```
Client Request
    ↓
POST /recommendation/start
    ↓
[Controller] Create job in DB with status=PENDING
    ↓
Return 202 Accepted with jobId immediately
    ↓
[Background] setImmediate() schedules async processing
    ↓
[Processor] Updates status to PROCESSING
    ↓
[Processor] Calls HotelAllocationService.previewFlightAllocation()
    ↓
[Processor] Wraps result in {success, requestId, timestamp, data}
    ↓
[Processor] Updates job with status=COMPLETED, result stored
    ↓
[Client] Polls GET /recommendation/:jobId
    ↓
Return job details with result
```

---

## 📊 Data Structure - Result Object

The `result` field in the completed job contains the entire recommendation data:

```typescript
result: {
  success: boolean;
  requestId: string;              // Echo of the original request ID
  timestamp: ISO8601_string;
  data: {
    cancelledFlightId: number;
    flightNumber: string;
    flightStatus: string;
    checkInDate: "YYYY-MM-DD";
    checkOutDate: "YYYY-MM-DD";
    departureAirport: string;
    supplyBufferRatio: number;    // e.g., 1.5
    totalPnrs: number;
    allocatedPnrs: number;
    unallocatedPnrs: number;
    allAllocated: boolean;
    
    supplyPool: Array<{           // Available hotel supply per room shape
      shape: { adults: number; children: number };
      roomsNeeded: number;        // How many rooms this split needs
      target: number;             // Target number of whole sets
      poolAllotment: number;      // How many allocated
      targetMet: boolean;
      totalAllotment: number;    // Total room-nights
      hotels: string[];          // Hotel codes serving this shape
      rates: number;             // Number of rate options
    }>;
    
    splits: Array<{               // Allocation splits (one per different room config)
      rooms: Array<{ adults: number; children: number }>;
      roomSplitOptions: {
        preferred: Array<{ adults: number; children: number }>;
        fallbacks: Array<{ adults: number; children: number }>;
      };
      bookedAsOneOrder: boolean;
      totalPnrs: number;
      pnrs: Array<{               // Individual PNR recommendations
        order: number;
        bookingId: number;
        pnr: string;
        travelClass: string;      // "first_class", "business", etc
        minStars: number;         // Minimum hotel rating for this class
        adults: number;
        children: number;
        recommended: {            // The allocation algorithm's choice
          rank: number;           // Ranking position
          hotelCode: string;
          hotelName: string;
          stars: number;
          price: number;          // Per room-night
          currency: string;       // "USD", etc
          rooms: Array<{
            adults: number;
            children: number;
            roomsNeeded: number;
            roomName: string;
            boardName: string;    // "Room Only", "Breakfast", etc
            paymentType: string;  // "deposit", "full_prepay"
            freeCancellationBefore: ISO8601_datetime;
            netPrice: number;
            rateKey: string;      // Supplier's rate key for booking
          }>;
        };
      }>;
    }>;
  };
}
```

---

## 🧪 Client Implementation Examples

### JavaScript/TypeScript with polling

```typescript
class RecommendationClient {
  async startRecommendation(flightId: number, token: string): Promise<string> {
    const response = await fetch(
      `/api/v1/cancelled-flights/${flightId}/plan-preview/recommendation/start`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const { jobId } = await response.json();
    return jobId;
  }

  async pollResult(
    jobId: string,
    token: string,
    maxWaitMs: number = 60000,
    intervalMs: number = 1000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(
        `/api/v1/cancelled-flights/plan-preview/recommendation/${jobId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const job = await response.json();

      if (job.status === 'COMPLETED') {
        return job.result;
      }

      if (job.status === 'FAILED') {
        throw new Error(`Job failed: ${job.errorMessage}`);
      }

      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Job ${jobId} did not complete within ${maxWaitMs}ms`);
  }

  async recommend(flightId: number, token: string): Promise<any> {
    const jobId = await this.startRecommendation(flightId, token);
    return this.pollResult(jobId, token);
  }
}

// Usage
const client = new RecommendationClient();
const result = await client.recommend(156, 'your-token');
console.log('Recommendation:', result.data);
```

### cURL with polling loop

```bash
#!/bin/bash

FLIGHT_ID=156
TOKEN="your-token"
API_BASE="https://api.example.com/api/v1"

# Start the job
echo "Starting recommendation job..."
RESPONSE=$(curl -s -X POST \
  "$API_BASE/cancelled-flights/$FLIGHT_ID/plan-preview/recommendation/start" \
  -H "Authorization: Bearer $TOKEN")

JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
echo "Job started: $JOB_ID"

# Poll until complete
echo "Polling for results..."
while true; do
  POLL=$(curl -s -X GET \
    "$API_BASE/cancelled-flights/plan-preview/recommendation/$JOB_ID" \
    -H "Authorization: Bearer $TOKEN")

  STATUS=$(echo $POLL | jq -r '.status')
  echo "Status: $STATUS"

  if [ "$STATUS" == "COMPLETED" ]; then
    echo "Job completed!"
    echo $POLL | jq '.result'
    break
  elif [ "$STATUS" == "FAILED" ]; then
    echo "Job failed!"
    echo $POLL | jq '.errorMessage'
    exit 1
  fi

  # Wait before next poll
  sleep 2
done
```

---

## ⏱️ Timing & Expiration

- **Job Expiration**: Jobs expire after 7 days
- **Polling**: Recommend polling every 1-5 seconds for best UX
- **Timeout**: HTTP client timeout should be much shorter than job processing (e.g., 10s)
- **Cleanup**: Expired jobs are cleaned up automatically daily at 2:00 AM UTC

---

## 🔐 Access Control

Both endpoints require:
- Valid JWT token (Bearer authentication)
- User type: PLATFORM or AIRLINE
- Access to view CANCELLED_FLIGHTS

The job can only be retrieved by:
- The user who started it, OR
- Another user of the same airline/platform with VIEW access

---

## ⚠️ Error Handling

### Common Errors

**400 Bad Request**
- Invalid flight ID format
- Invalid job ID format

**401 Unauthorized**
- Missing or invalid token

**403 Forbidden**
- Trying to access another airline's flight
- Insufficient permissions

**404 Not Found**
- Flight doesn't exist
- Job doesn't exist
- Job has expired (>7 days)

---

## 🧵 Background Processing Details

### How It Works

1. **Request Handler** (Controller)
   - Validates user access
   - Creates job record with status=PENDING
   - Returns 202 Accepted immediately

2. **Background Scheduler** (Controller)
   - Uses `setImmediate()` to schedule async processing
   - Non-blocking - returns control immediately

3. **Processor** (RecommendationJobProcessor)
   - Updates status to PROCESSING
   - Calls existing HotelAllocationService
   - Wraps result
   - Updates job with result or error
   - Cleans up expired jobs daily (cron @2:00 AM UTC)

### Configuration

The processor:
- Uses NestJS `@Schedule` for cleanup tasks
- Runs cleanup daily at 2:00 AM UTC
- Automatically deletes jobs older than 7 days

---

## 🗂️ Files Changed

### New Files
- `/backend/src/database/migrations/20261122_recommendation_jobs.sql` - Database migration
- `/backend/src/cancelled-flights/entities/recommendation-job.entity.ts` - TypeORM entity
- `/backend/src/cancelled-flights/recommendation-job.service.ts` - Service for job management
- `/backend/src/cancelled-flights/recommendation-job.processor.ts` - Background processor
- `/backend/src/cancelled-flights/dto/recommendation-job.dto.ts` - Response DTOs

### Modified Files
- `/backend/src/cancelled-flights/cancelled-flights.module.ts` - Added entities, services, and @nestjs/schedule
- `/backend/src/cancelled-flights/cancelled-flights.controller.ts` - Added two new endpoints
- `/backend/package.json` - Added @nestjs/schedule dependency

---

## 🏃 Testing

### Manual Testing

```bash
# 1. Start a job
curl -X POST http://localhost:3000/api/v1/cancelled-flights/156/plan-preview/recommendation/start \
  -H "Authorization: Bearer your-token"

# 2. Poll the result
curl -X GET http://localhost:3000/api/v1/cancelled-flights/plan-preview/recommendation/YOUR_JOB_ID \
  -H "Authorization: Bearer your-token"
```

### Unit Testing

The service and processor can be tested independently:

```typescript
describe('RecommendationJobService', () => {
  let service: RecommendationJobService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RecommendationJobService,
        {
          provide: getRepositoryToken(RecommendationJobEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get(RecommendationJobService);
  });

  it('should create a job', async () => {
    const jobId = await service.createJob(156);
    expect(jobId).toBeDefined();
  });

  it('should retrieve a job', async () => {
    const job = await service.getJob(jobId);
    expect(job.id).toBe(jobId);
  });
});
```

---

## 📈 Monitoring

### Useful Queries

**Check pending jobs:**
```sql
SELECT id, flight_id, status, created_at
FROM recommendation_jobs
WHERE status IN ('PENDING', 'PROCESSING')
ORDER BY created_at DESC
LIMIT 10;
```

**Check failed jobs:**
```sql
SELECT id, flight_id, error_message, completed_at
FROM recommendation_jobs
WHERE status = 'FAILED'
ORDER BY completed_at DESC
LIMIT 10;
```

**Check expiration:**
```sql
SELECT COUNT(*) as expired_count
FROM recommendation_jobs
WHERE expires_at < now();
```

---

## 🔄 Migration from Sync to Async

If you're currently using the sync endpoint and want to switch to async:

```typescript
// OLD (sync) - times out for large allocations
const response = await fetch(
  `/api/v1/cancelled-flights/156/plan-preview/recommendation`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const data = await response.json();

// NEW (async) - no timeout, better UX
const jobStart = await fetch(
  `/api/v1/cancelled-flights/156/plan-preview/recommendation/start`,
  { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
);
const { jobId } = await jobStart.json();

// Poll until complete...
```

Both endpoints return the same result structure, so your result processing code stays identical.

---

## 📝 Notes

- The sync endpoint (`GET /:id/plan-preview/recommendation`) still works and hasn't changed
- The async endpoints are **new** and optional
- Use async for large allocations (>100 PNRs) or slow supplier connections
- Use sync for quick testing and simple cases
- Response data is 100% compatible between sync and async
- Jobs are fully isolated per flight and user

---

## 🐛 Troubleshooting

**Job stuck in PROCESSING**
- Check the application logs for errors
- Verify the flight exists and has valid data
- Check supplier API connectivity

**404 when retrieving result**
- Job may have expired (>7 days)
- Job ID may be malformed
- Try restarting with a new job

**502/503 errors**
- Backend may be overloaded
- Try polling with longer intervals
- Check application health

---

## ✅ Verification Checklist

After deployment:
- [ ] Database migration runs successfully
- [ ] `recommendation_jobs` table created with correct schema
- [ ] POST endpoint returns 202 with jobId
- [ ] GET endpoint returns job status
- [ ] Background processing completes successfully
- [ ] Result is wrapped correctly with job metadata
- [ ] Expired jobs are cleaned up (check logs at 2:00 AM)
- [ ] Logs show job lifecycle (PENDING → PROCESSING → COMPLETED)

---

**Version**: 1.0
**Last Updated**: 2026-11-22
**Status**: Production Ready ✅
