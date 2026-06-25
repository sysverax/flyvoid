/**
 * Airline invitation seeders — black-box e2e only.
 *
 * Raw SQL helpers for airline invitations and related access controls.
 */
import * as bcrypt from "bcrypt";
import { query } from "../helpers/db-client.helper";

const BCRYPT_ROUNDS = 10;

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED";
export type HistoryEvent = "SENT" | "RESENT" | "REVOKED" | "ACCEPTED";

export async function grantInvitePermission(
  adminId: number,
  action: "VIEW" | "EDIT",
): Promise<void> {
  await query(
    `INSERT INTO platform_access_controls (admin_id, asset, access_action)
     VALUES ($1, $2, $3)
     ON CONFLICT (admin_id, asset, access_action) DO NOTHING`,
    [adminId, "INVITES_ONBOARDING", action],
  );
}

export async function clearInvitePermissions(adminId: number): Promise<void> {
  await query(
    `DELETE FROM platform_access_controls WHERE admin_id = $1 AND asset = 'INVITES_ONBOARDING'`,
    [adminId],
  );
}

export async function insertAirlineRow(params: {
  name: string;
  code: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logo?: string;
  address: string;
  currency: string;
  isActive?: boolean;
  invitationId?: number | null;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO airlines
      (name, code, country_code, company_registration_number, website, contact_email, contact_phone, timezone, logo, address, currency, is_active, invitation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      params.name,
      params.code,
      params.countryCode,
      params.companyRegistrationNumber,
      params.website ?? null,
      params.contactEmail,
      params.contactPhone,
      params.timezone,
      params.logo ?? null,
      params.address,
      params.currency,
      params.isActive ?? true,
      params.invitationId ?? null,
    ],
  );
  return res.rows[0].id;
}

export async function insertAirlineUserRow(params: {
  airlineId: number;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  jobTitle?: string;
  role?: "AIRLINE_ADMIN" | "AIRLINE_STAFF";
  isActive?: boolean;
  requirePasswordReset?: boolean;
}): Promise<number> {
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const res = await query<{ id: number }>(
    `INSERT INTO airline_users
      (airline_id, first_name, last_name, email, job_title, password_hash, role, is_active, require_password_reset)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      params.airlineId,
      params.firstName ?? "Airline",
      params.lastName ?? "User",
      params.email.toLowerCase().trim(),
      params.jobTitle ?? "Manager",
      passwordHash,
      params.role ?? "AIRLINE_ADMIN",
      params.isActive ?? true,
      params.requirePasswordReset ?? false,
    ],
  );

  return res.rows[0].id;
}

export async function insertMetaInviteRow(params: {
  airlineName: string;
  airlineCode: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  currency: string;
  address: string;
  logo?: string;
  creditLimit?: number;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminJobTitle: string;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO meta_airline_invites
      (airline_name, airline_code, country_code, company_registration_number, website, contact_email, contact_phone, timezone, currency, address, logo, credit_limit, admin_first_name, admin_last_name, admin_email, admin_job_title)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      params.airlineName,
      params.airlineCode,
      params.countryCode,
      params.companyRegistrationNumber,
      params.website ?? null,
      params.contactEmail,
      params.contactPhone,
      params.timezone,
      params.currency,
      params.address,
      params.logo ?? null,
      params.creditLimit ?? 0,
      params.adminFirstName,
      params.adminLastName,
      params.adminEmail.toLowerCase().trim(),
      params.adminJobTitle,
    ],
  );

  return res.rows[0].id;
}

export async function insertInviteRow(params: {
  metaId: number;
  invitedByAdminId: number;
  status?: InvitationStatus;
  expiresAt?: Date;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  airlineId?: number | null;
}): Promise<number> {
  const tokenLookup = `lookup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tokenHash = await bcrypt.hash(`token-${tokenLookup}`, BCRYPT_ROUNDS);
  const res = await query<{ id: number }>(
    `INSERT INTO airline_admin_invites
      (airline_id, meta_id, invited_by_admin_id, token_lookup, token_hash, expires_at, status, accepted_at, revoked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      params.airlineId ?? null,
      params.metaId,
      params.invitedByAdminId,
      tokenLookup,
      tokenHash,
      params.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000),
      params.status ?? "PENDING",
      params.acceptedAt ?? null,
      params.revokedAt ?? null,
    ],
  );

  return res.rows[0].id;
}

export async function insertInviteHistoryRow(params: {
  invitationId: number;
  event: HistoryEvent;
  performedByAdminId?: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO airline_admin_invite_history (invitation_id, event, performed_by_admin_id)
     VALUES ($1,$2,$3)`,
    [params.invitationId, params.event, params.performedByAdminId ?? null],
  );
}

export async function getLatestInvitationIdByAdminEmail(
  adminEmail: string,
): Promise<number | null> {
  const res = await query<{ id: number }>(
    `SELECT i.id
       FROM airline_admin_invites i
       JOIN meta_airline_invites m ON m.id = i.meta_id
      WHERE m.admin_email = $1
      ORDER BY i.id DESC
      LIMIT 1`,
    [adminEmail.toLowerCase().trim()],
  );
  return res.rows[0]?.id ?? null;
}

export async function setInvitationStatus(
  invitationId: number,
  status: InvitationStatus,
  options: {
    acceptedAt?: Date | null;
    revokedAt?: Date | null;
    expiresAt?: Date;
  } = {},
): Promise<void> {
  await query(
    `UPDATE airline_admin_invites
        SET status = $2,
            accepted_at = $3,
            revoked_at = $4,
            expires_at = $5,
            updated_at = NOW()
      WHERE id = $1`,
    [
      invitationId,
      status,
      options.acceptedAt ?? null,
      options.revokedAt ?? null,
      options.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000),
    ],
  );
}

export async function deleteInvitationDataByPattern(
  pattern: string,
): Promise<void> {
  await query(
    `DELETE FROM airline_admin_invites
      WHERE meta_id IN (
        SELECT id FROM meta_airline_invites
         WHERE admin_email LIKE $1
            OR airline_code LIKE $1
            OR company_registration_number LIKE $1
      )`,
    [pattern],
  );

  await query(
    `DELETE FROM meta_airline_invites
      WHERE admin_email LIKE $1
         OR airline_code LIKE $1
         OR company_registration_number LIKE $1`,
    [pattern],
  );

  await query(`DELETE FROM airline_users WHERE email LIKE $1`, [pattern]);

  await query(
    `DELETE FROM airlines
      WHERE code LIKE $1
         OR company_registration_number LIKE $1
         OR contact_email LIKE $1`,
    [pattern],
  );
}
