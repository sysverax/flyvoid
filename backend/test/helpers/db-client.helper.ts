/**
 * Database client helper — black-box e2e only.
 *
 * Wraps a lazy `pg.Pool` singleton so every spec file can run raw SQL
 * against the test Postgres instance without importing anything from src/.
 *
 * Usage:
 *   import { query, endPool } from '../helpers/db-client.helper';
 *
 *   const rows = await query('SELECT id FROM admins WHERE email = $1', [email]);
 *   // In afterAll:
 *   await endPool();
 */
import { Pool, QueryResult } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Ensure jest.setup.ts has loaded automation_test.env.",
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query<
  T extends Record<string, unknown> = Record<string, unknown>,
>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

/**
 * Close the pool. Call this in `afterAll` of each spec file that uses the DB.
 */
export async function endPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
