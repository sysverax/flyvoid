/**
 * Database cleanup helper — black-box e2e only.
 *
 * Contains raw SQL DELETE/TRUNCATE statements for resetting admin-related
 * tables between tests. Uses real Postgres table names from the TypeORM
 * entities:
 *
 *   admins                    — AdminEntity
 *   refresh_tokens            — RefreshTokenEntity  (CASCADE from admins)
 *   admin_password_reset_otps — AdminPasswordResetOtpEntity (CASCADE from admins)
 *   platform_access_controls  — PlatformAccessControlEntity (CASCADE from admins)
 *
 * Deleting from `admins` cascades to all child tables automatically
 * because the FK relationships are defined with ON DELETE CASCADE.
 *
 * Usage:
 *   import { deleteAdminByEmail, deleteAdminsByEmailPattern } from '../helpers/db-cleanup.helper';
 *
 *   afterAll(async () => {
 *     await deleteAdminsByEmailPattern('%@e2e.test');
 *   });
 */
import { query } from "./db-client.helper";

/**
 * Deletes a single admin row (and cascades to refresh_tokens,
 * admin_password_reset_otps, platform_access_controls).
 */
export async function deleteAdminByEmail(email: string): Promise<void> {
  await query(`DELETE FROM admins WHERE email = $1`, [
    email.toLowerCase().trim(),
  ]);
}

/**
 * Deletes all admin rows whose email matches a LIKE pattern.
 * Example pattern: '%@e2e.test'
 */
export async function deleteAdminsByEmailPattern(
  pattern: string,
): Promise<void> {
  await query(`DELETE FROM admins WHERE email LIKE $1`, [pattern]);
}

/**
 * Hard-truncates all admin-related tables.
 * Only use in isolated test environments — this removes ALL data.
 */
export async function truncateAdminTables(): Promise<void> {
  await query(
    `TRUNCATE TABLE admin_password_reset_otps, refresh_tokens, platform_access_controls, admins RESTART IDENTITY CASCADE`,
  );
}
