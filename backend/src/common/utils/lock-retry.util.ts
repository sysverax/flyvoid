/** PostgreSQL deadlock_detected and lock_not_available (lock_timeout). */
const RETRYABLE_LOCK_ERRORS = new Set(["40P01", "55P03"]);

export function isLockConflictError(error: unknown): boolean {
  const err = error as { code?: string; driverError?: { code?: string } };
  return RETRYABLE_LOCK_ERRORS.has(err?.code ?? err?.driverError?.code ?? "");
}

/**
 * Runs a transaction again when PostgreSQL aborted it for a deadlock or a lock
 * timeout. The work must be safe to repeat: the aborted attempt was rolled back.
 */
export async function retryOnLockConflict<T>(
  work: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isLockConflictError(error)) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 50 * attempt + Math.floor(Math.random() * 100)),
      );
    }
  }
}
