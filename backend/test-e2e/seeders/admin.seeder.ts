/**
 * Admin database seeders — black-box e2e only.
 *
 * Each function inserts rows DIRECTLY into Postgres using raw SQL so that
 * tests can pre-create admin states that the API cannot easily reach
 * (e.g. an inactive admin, an admin with a known temporary password).
 *
 * Rules:
 *  - Every function uses the `query()` helper from db-client.helper.ts.
 *  - NO imports from src/ — `bcrypt` is used directly from node_modules.
 *  - SQL uses real column names from the TypeORM entities:
 *      Table: admins
 *        id, first_name, last_name, email, password_hash,
 *        role (enum: SUPER_ADMIN | STAFF), is_active,
 *        require_password_reset, two_factor_enabled,
 *        two_factor_secret_encrypted, two_factor_temp_secret_encrypted,
 *        two_factor_recovery_code_hashes, last_login_at,
 *        created_at, updated_at
 *      Table: refresh_tokens
 *        id, admin_id, token_hash, expires_at, is_revoked,
 *        created_at, updated_at
 *      Table: admin_password_reset_otps
 *        id, admin_id, otp_hash, expires_at, attempt_count,
 *        is_verified, is_used, created_at, updated_at
 *
 * Deleting from `admins` cascades to refresh_tokens,
 * admin_password_reset_otps, and platform_access_controls automatically
 * (all foreign keys are ON DELETE CASCADE).
 */
import * as bcrypt from "bcrypt";
import { query } from "../helpers/db-client.helper";

const BCRYPT_ROUNDS = 10;

// ─── Param / return types ────────────────────────────────────────────────────

export interface SeedAdminParams {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  /** Defaults to 'SUPER_ADMIN'. Valid values: 'SUPER_ADMIN' | 'STAFF' */
  role?: string;
}

export interface SeededAdmin {
  id: number;
  email: string;
  role: string;
}

// ─── Admin seeders ───────────────────────────────────────────────────────────

/**
 * Inserts an active admin with is_active=true and require_password_reset=false.
 * Use for: normal signin tests, 2FA tests, token tests.
 */
export async function insertActiveAdmin(
  params: SeedAdminParams,
): Promise<SeededAdmin> {
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const role = params.role ?? "SUPER_ADMIN";
  const firstName = params.firstName ?? "Test";
  const lastName = params.lastName ?? "Admin";

  const result = await query<SeededAdmin>(
    `INSERT INTO admins
       (first_name, last_name, email, password_hash, role, is_active, require_password_reset)
     VALUES ($1, $2, $3, $4, $5::admins_role_enum, $6, $7)
     RETURNING id, email, role`,
    [
      firstName,
      lastName,
      params.email.toLowerCase().trim(),
      passwordHash,
      role,
      true,
      false,
    ],
  );
  return result.rows[0];
}

/**
 * Inserts an inactive admin with is_active=false.
 * Use for: testing that inactive accounts cannot sign in.
 */
export async function insertInactiveAdmin(
  params: SeedAdminParams,
): Promise<SeededAdmin> {
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const role = params.role ?? "SUPER_ADMIN";
  const firstName = params.firstName ?? "Inactive";
  const lastName = params.lastName ?? "Admin";

  const result = await query<SeededAdmin>(
    `INSERT INTO admins
       (first_name, last_name, email, password_hash, role, is_active, require_password_reset)
     VALUES ($1, $2, $3, $4, $5::admins_role_enum, $6, $7)
     RETURNING id, email, role`,
    [
      firstName,
      lastName,
      params.email.toLowerCase().trim(),
      passwordHash,
      role,
      false, // is_active = false
      false,
    ],
  );
  return result.rows[0];
}

/**
 * Inserts an admin with require_password_reset=true (first-login state).
 * Use for: testing the initial-password-reset flow and the signin challenge.
 */
export async function insertAdminWithPasswordResetRequired(
  params: SeedAdminParams,
): Promise<SeededAdmin> {
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const role = params.role ?? "STAFF";
  const firstName = params.firstName ?? "Reset";
  const lastName = params.lastName ?? "Admin";

  const result = await query<SeededAdmin>(
    `INSERT INTO admins
       (first_name, last_name, email, password_hash, role, is_active, require_password_reset)
     VALUES ($1, $2, $3, $4, $5::admins_role_enum, $6, $7)
     RETURNING id, email, role`,
    [
      firstName,
      lastName,
      params.email.toLowerCase().trim(),
      passwordHash,
      role,
      true,
      true, // require_password_reset = true
    ],
  );
  return result.rows[0];
}

// ─── OTP seeder ──────────────────────────────────────────────────────────────

/**
 * Inserts an admin_password_reset_otps row with the given parameters.
 * Use for: testing max-attempts exhaustion by directly seeding
 * attempt_count = 5 (the maximum), which the HTTP API cannot produce
 * directly in black-box mode without 5 sequential failing calls.
 *
 * Note: `otp_hash` stores a bcrypt hash of the OTP string.
 * In test env the static OTP is '444444'.
 */
export async function insertExhaustedOtpRecord(adminId: number): Promise<void> {
  const otpHash = await bcrypt.hash("444444", BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

  await query(
    `INSERT INTO admin_password_reset_otps
       (admin_id, otp_hash, expires_at, attempt_count, is_verified, is_used)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, otpHash, expiresAt, 5, false, false],
  );
}

/**
 * Inserts an admin_password_reset_otps row that is already expired.
 * Use for: testing expired-OTP rejection without waiting for real expiry.
 */
export async function insertExpiredOtpRecord(adminId: number): Promise<void> {
  const otpHash = await bcrypt.hash("444444", BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes in the past

  await query(
    `INSERT INTO admin_password_reset_otps
       (admin_id, otp_hash, expires_at, attempt_count, is_verified, is_used)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, otpHash, expiresAt, 0, false, false],
  );
}

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/**
 * Returns the admin row id for a given email, or null if not found.
 * Use this when you need the admin id to seed related rows (OTP, etc.).
 */
export async function getAdminIdByEmail(email: string): Promise<number | null> {
  const result = await query<{ id: number }>(
    `SELECT id FROM admins WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return result.rows[0]?.id ?? null;
}

// ─── Delete helpers ───────────────────────────────────────────────────────────

/**
 * Deletes a single admin (cascades to all child tables).
 */
export async function deleteAdminByEmail(email: string): Promise<void> {
  await query(`DELETE FROM admins WHERE email = $1`, [
    email.toLowerCase().trim(),
  ]);
}

/**
 * Deletes all admins whose email matches a LIKE pattern.
 * Example: '%@e2e.test'
 */
export async function deleteAdminsByEmailPattern(
  pattern: string,
): Promise<void> {
  await query(`DELETE FROM admins WHERE email LIKE $1`, [pattern]);
}
