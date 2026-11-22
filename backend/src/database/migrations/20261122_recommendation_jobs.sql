-- Async recommendation job tracking: POST /cancelled-flights/:flightId/plan-preview/recommendation/start
-- starts a background allocation recommendation job; GET .../recommendation/:jobId reads the result.
-- Rows expire after 7 days and are deleted by a scheduled cleanup task.

CREATE TABLE IF NOT EXISTS public.recommendation_jobs (
  -- The job id returned by the POST (jobId in its response).
  id uuid PRIMARY KEY,

  -- PENDING | PROCESSING | COMPLETED | FAILED
  status varchar(20) NOT NULL DEFAULT 'PENDING',

  -- The cancelled flight id being processed
  flight_id integer NOT NULL,

  -- The entire recommendation result once processing completes
  -- Format: { success: boolean, requestId: string, timestamp: string, data: {...} }
  result jsonb,

  -- Error message if status is FAILED
  error_message text,

  -- Timestamps
  expires_at timestamp without time zone NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  completed_at timestamp without time zone,
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_recommendation_jobs_expires_at
  ON public.recommendation_jobs (expires_at);

-- Index for retrieving a flight's jobs
CREATE INDEX IF NOT EXISTS idx_recommendation_jobs_flight_id
  ON public.recommendation_jobs (flight_id);

-- Index for status polling
CREATE INDEX IF NOT EXISTS idx_recommendation_jobs_status
  ON public.recommendation_jobs (status);
