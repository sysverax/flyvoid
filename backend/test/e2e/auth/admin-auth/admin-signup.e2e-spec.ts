/**
 * E2E tests for POST /api/v1/auth/admin/signup
 *
 * Black-box: all interactions via HTTP (supertest) and raw SQL (pg).
 * No imports from src/.
 */
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import {
  uniqueEmail,
  validSignupPayload,
  weakPasswordPayload,
  noUpperCasePasswordPayload,
  noLowerCasePasswordPayload,
  noNumberPasswordPayload,
  noSpecialCharPasswordPayload,
  invalidEmailPayload,
  missingFirstNamePayload,
  missingLastNamePayload,
  missingEmailPayload,
  missingPasswordPayload,
  shortFirstNamePayload,
  shortLastNamePayload,
  longFirstNamePayload,
  longLastNamePayload,
  numericFirstNamePayload,
  numericLastNamePayload,
  specialCharsFirstNamePayload,
  specialCharsLastNamePayload,
  unknownFieldsSignupPayload,
  sqlInjectionEmailPayload,
  scriptInjectionFirstNamePayload,
} from "../../../fixtures/admin.fixture";
import { describe, it } from "node:test";
import { beforeAll, afterAll, expect } from "@jest/globals";
const EMAIL_PATTERN = "%@e2e.test";

describe("POST /api/v1/auth/admin/signup", () => {
  // Email for the "pre-existing admin" used by duplicate tests (TC_002, TC_032)
  let existingAdminEmail: string;

  beforeAll(async () => {
    // Create a pre-existing admin that duplicate tests can collide against.
    existingAdminEmail = uniqueEmail("signup-existing");
    await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(existingAdminEmail))
      .expect(201);
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // ─── Happy-path ───────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_001
  it("TC_AUTH_ADMIN_SIGNUP_001: Admin signup success → 201 with id, email, role", async () => {
    const email = uniqueEmail("signup-001");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Admin created successfully");
    expect(res.body.data.id).toBeDefined();
    expect(typeof res.body.data.id).toBe("number");
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBeDefined();
  });

  // TC_AUTH_ADMIN_SIGNUP_017
  it("TC_AUTH_ADMIN_SIGNUP_017: Email normalized to lowercase → 201, data.email is lowercase", async () => {
    const base = uniqueEmail("signup-017");
    const upperEmail = base.toUpperCase();
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(upperEmail));

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(base.toLowerCase());
  });

  // TC_AUTH_ADMIN_SIGNUP_018
  it("TC_AUTH_ADMIN_SIGNUP_018: Email with leading/trailing spaces → 201, trimmed and stored lowercase", async () => {
    const email = uniqueEmail("signup-018");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(`  ${email}  `));

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);
  });

  // TC_AUTH_ADMIN_SIGNUP_033
  it("TC_AUTH_ADMIN_SIGNUP_033: Minimum firstName length (2 chars) → 201", async () => {
    const email = uniqueEmail("signup-033");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { firstName: "Jo" }));

    expect(res.status).toBe(201);
  });

  // TC_AUTH_ADMIN_SIGNUP_034
  it("TC_AUTH_ADMIN_SIGNUP_034: Minimum lastName length (2 chars) → 201", async () => {
    const email = uniqueEmail("signup-034");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { lastName: "Li" }));

    expect(res.status).toBe(201);
  });

  // TC_AUTH_ADMIN_SIGNUP_035
  it("TC_AUTH_ADMIN_SIGNUP_035: Minimum password length (8 chars) → 201", async () => {
    const email = uniqueEmail("signup-035");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { password: "Pass@123" }));

    expect(res.status).toBe(201);
  });

  // TC_AUTH_ADMIN_SIGNUP_036
  it("TC_AUTH_ADMIN_SIGNUP_036: Maximum firstName length (100 chars) → 201", async () => {
    const email = uniqueEmail("signup-036");
    const firstName = `A${"b".repeat(99)}`; // 100 chars, starts with letter
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { firstName }));

    expect(res.status).toBe(201);
  });

  // TC_AUTH_ADMIN_SIGNUP_037
  it("TC_AUTH_ADMIN_SIGNUP_037: Maximum lastName length (100 chars) → 201", async () => {
    const email = uniqueEmail("signup-037");
    const lastName = `Z${"a".repeat(99)}`; // 100 chars
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { lastName }));

    expect(res.status).toBe(201);
  });

  // TC_AUTH_ADMIN_SIGNUP_042
  it("TC_AUTH_ADMIN_SIGNUP_042: Unicode firstName and lastName → 201", async () => {
    const email = uniqueEmail("signup-042");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(
        validSignupPayload(email, { firstName: "Ñoño", lastName: "Müller" }),
      );

    expect(res.status).toBe(201);
  });

  // ─── Conflict ─────────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_002
  it("TC_AUTH_ADMIN_SIGNUP_002: Duplicate admin email → 409", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(existingAdminEmail));

    expect(res.status).toBe(409);
    expect(res.body.statusCode).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // TC_AUTH_ADMIN_SIGNUP_032
  it("TC_AUTH_ADMIN_SIGNUP_032: Duplicate email in different case → 409", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(existingAdminEmail.toUpperCase()));

    expect(res.status).toBe(409);
  });

  // ─── Email validation ──────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_003
  it("TC_AUTH_ADMIN_SIGNUP_003: Invalid email format → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(invalidEmailPayload);

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  // TC_AUTH_ADMIN_SIGNUP_011
  it("TC_AUTH_ADMIN_SIGNUP_011: Missing email field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(missingEmailPayload);

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_021
  it("TC_AUTH_ADMIN_SIGNUP_021: Empty email string → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload("", { email: "" }));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_025
  it("TC_AUTH_ADMIN_SIGNUP_025: Null email → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload("placeholder@e2e.test", { email: null }));

    expect(res.status).toBe(400);
  });

  // ─── Password validation ───────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_004
  it("TC_AUTH_ADMIN_SIGNUP_004: Password shorter than 8 chars → 400", async () => {
    const email = uniqueEmail("signup-004");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(weakPasswordPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_005
  it("TC_AUTH_ADMIN_SIGNUP_005: Password without uppercase → 400", async () => {
    const email = uniqueEmail("signup-005");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(noUpperCasePasswordPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_006
  it("TC_AUTH_ADMIN_SIGNUP_006: Password without lowercase → 400", async () => {
    const email = uniqueEmail("signup-006");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(noLowerCasePasswordPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_007
  it("TC_AUTH_ADMIN_SIGNUP_007: Password without numeric character → 400", async () => {
    const email = uniqueEmail("signup-007");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(noNumberPasswordPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_008
  it("TC_AUTH_ADMIN_SIGNUP_008: Password without special character → 400", async () => {
    const email = uniqueEmail("signup-008");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(noSpecialCharPasswordPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_012
  it("TC_AUTH_ADMIN_SIGNUP_012: Missing password field → 400", async () => {
    const email = uniqueEmail("signup-012");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(missingPasswordPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_022
  it("TC_AUTH_ADMIN_SIGNUP_022: Empty password string → 400", async () => {
    const email = uniqueEmail("signup-022");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { password: "" }));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_026
  it("TC_AUTH_ADMIN_SIGNUP_026: Null password → 400", async () => {
    const email = uniqueEmail("signup-026");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { password: null }));

    expect(res.status).toBe(400);
  });

  // ─── firstName validation ──────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_009
  it("TC_AUTH_ADMIN_SIGNUP_009: Missing firstName field → 400", async () => {
    const email = uniqueEmail("signup-009");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(missingFirstNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_013
  it("TC_AUTH_ADMIN_SIGNUP_013: firstName shorter than 2 chars → 400", async () => {
    const email = uniqueEmail("signup-013");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(shortFirstNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_015
  it("TC_AUTH_ADMIN_SIGNUP_015: firstName exceeds 100 chars → 400", async () => {
    const email = uniqueEmail("signup-015");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(longFirstNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_019
  it("TC_AUTH_ADMIN_SIGNUP_019: Empty firstName string → 400", async () => {
    const email = uniqueEmail("signup-019");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { firstName: "" }));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_023
  it("TC_AUTH_ADMIN_SIGNUP_023: Null firstName → 400", async () => {
    const email = uniqueEmail("signup-023");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { firstName: null }));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_027
  it("TC_AUTH_ADMIN_SIGNUP_027: Numeric firstName → 400", async () => {
    const email = uniqueEmail("signup-027");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(numericFirstNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_029
  it("TC_AUTH_ADMIN_SIGNUP_029: Special characters only in firstName → 400", async () => {
    const email = uniqueEmail("signup-029");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(specialCharsFirstNamePayload(email));

    expect(res.status).toBe(400);
  });

  // ─── lastName validation ───────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_010
  it("TC_AUTH_ADMIN_SIGNUP_010: Missing lastName field → 400", async () => {
    const email = uniqueEmail("signup-010");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(missingLastNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_014
  it("TC_AUTH_ADMIN_SIGNUP_014: lastName shorter than 2 chars → 400", async () => {
    const email = uniqueEmail("signup-014");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(shortLastNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_016
  it("TC_AUTH_ADMIN_SIGNUP_016: lastName exceeds 100 chars → 400", async () => {
    const email = uniqueEmail("signup-016");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(longLastNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_020
  it("TC_AUTH_ADMIN_SIGNUP_020: Empty lastName string → 400", async () => {
    const email = uniqueEmail("signup-020");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { lastName: "" }));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_024
  it("TC_AUTH_ADMIN_SIGNUP_024: Null lastName → 400", async () => {
    const email = uniqueEmail("signup-024");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email, { lastName: null }));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_028
  it("TC_AUTH_ADMIN_SIGNUP_028: Numeric lastName → 400", async () => {
    const email = uniqueEmail("signup-028");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(numericLastNamePayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_030
  it("TC_AUTH_ADMIN_SIGNUP_030: Special characters only in lastName → 400", async () => {
    const email = uniqueEmail("signup-030");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(specialCharsLastNamePayload(email));

    expect(res.status).toBe(400);
  });

  // ─── Multi-error & structural ──────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_031
  it("TC_AUTH_ADMIN_SIGNUP_031: Multiple validation errors → 400 with multiple entries in errors", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send({ firstName: "A", email: "bad", password: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.length).toBeGreaterThan(1);
  });

  // TC_AUTH_ADMIN_SIGNUP_038
  it("TC_AUTH_ADMIN_SIGNUP_038: Unknown extra field in body → 400 (forbidNonWhitelisted)", async () => {
    const email = uniqueEmail("signup-038");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(unknownFieldsSignupPayload(email));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_039
  it("TC_AUTH_ADMIN_SIGNUP_039: Malformed JSON payload → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .set("Content-Type", "application/json")
      .send('{ firstName: "Test", invalid json }');

    expect(res.status).toBe(400);
  });

  // ─── Security / injection ──────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNUP_040
  it("TC_AUTH_ADMIN_SIGNUP_040: SQL injection in email → 400 (rejected by @IsEmail)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(sqlInjectionEmailPayload);

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNUP_041
  it("TC_AUTH_ADMIN_SIGNUP_041: Script tag injection in firstName → 400 (rejected by @Matches regex)", async () => {
    const email = uniqueEmail("signup-041");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(scriptInjectionFirstNamePayload(email));

    expect(res.status).toBe(400);
  });

  // ─── Response shape ────────────────────────────────────────────────────────

  it("Signup success: response must not expose passwordHash or password field", async () => {
    const email = uniqueEmail("signup-nopassword");
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(validSignupPayload(email));

    expect(res.status).toBe(201);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it("Signup error response has correct error shape: statusCode, requestId, timestamp, path, message, errors[]", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signup")
      .send(invalidEmailPayload);

    expect(res.status).toBe(400);
    expect(typeof res.body.statusCode).toBe("number");
    expect(typeof res.body.requestId).toBe("string");
    expect(typeof res.body.timestamp).toBe("string");
    expect(typeof res.body.path).toBe("string");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.errors).toBeInstanceOf(Array);
  });
});
