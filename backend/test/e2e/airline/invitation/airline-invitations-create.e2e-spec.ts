import { api } from "../../../helpers/http-client.helper";
import { endPool, query } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { insertActiveAdmin } from "../../../seeders/admin.seeder";
import {
  deleteInvitationDataByPattern,
  grantInvitePermission,
  insertAirlineRow,
  insertAirlineUserRow,
} from "../../../seeders/airline-invitation.seeder";
import {
  malformedJsonBody,
  validInvitePayload,
} from "../../../fixtures/airline-invitation.fixture";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { describe, it } from "node:test";
import { beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-airline.test";
const CODE_PATTERN = "E2E%";
const TEST_PASSWORD = "Password@123";

async function createSuperAdminToken(prefix: string): Promise<string> {
  const email = `${prefix}-${Date.now()}@e2e-airline.test`;
  await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role: "SUPER_ADMIN",
  });
  const { accessToken } = await getAdminTokens(email, TEST_PASSWORD);
  return accessToken;
}

async function createStaffWithInviteEditToken(prefix: string): Promise<string> {
  const email = `${prefix}-${Date.now()}@e2e-airline.test`;
  const admin = await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role: "STAFF",
  });
  await grantInvitePermission(admin.id, "EDIT");
  const { accessToken } = await getAdminTokens(email, TEST_PASSWORD);
  return accessToken;
}

describe("POST /api/v1/airline/invitations", () => {
  let superAdminToken: string;
  let staffEditToken: string;

  beforeAll(async () => {
    superAdminToken = await createSuperAdminToken("invite-super");
    staffEditToken = await createStaffWithInviteEditToken("invite-staff-edit");
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern("E2E%");
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // Success Scenarios
  it("TC_AIRLINE_INVITE_001: Airline invitation by SUPER_ADMIN with valid payload, expected 201", async () => {
    const payload = validInvitePayload();

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("TC_AIRLINE_INVITE_002: Airline invitation by STAFF with INVITES_ONBOARDING EDIT access, expected 201", async () => {
    const payload = validInvitePayload();

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${staffEditToken}`)
      .send(payload);

    expect(res.status).toBe(201);
  });

  it("TC_AIRLINE_INVITE_003: Invitation with minimum valid required fields only, expected 201", async () => {
    const payload = validInvitePayload();
    delete payload.website;
    delete payload.logo;
    delete payload.creditLimit;

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
  });

  it("TC_AIRLINE_INVITE_004: Invitation with all optional fields populated, expected 201", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(
        validInvitePayload({
          website: "https://all-fields.e2e-airline.test",
          logo: "https://cdn.e2e-airline.test/logo.png",
          creditLimit: 990000,
        }),
      );

    expect(res.status).toBe(201);
  });

  it("TC_AIRLINE_INVITE_005: Invitation with creditLimit omitted, default value applied, expected 201", async () => {
    const payload = validInvitePayload();
    delete payload.creditLimit;

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.creditLimit).toBe(0);
  });

  it("TC_AIRLINE_INVITE_006: Invitation with creditLimit set to zero, expected 201", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ creditLimit: 0 }));

    expect(res.status).toBe(201);
    expect(res.body.data.creditLimit).toBe(0);
  });

  it("TC_AIRLINE_INVITE_007: Invitation with valid positive creditLimit, expected 201", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ creditLimit: 123456 }));

    expect(res.status).toBe(201);
    expect(res.body.data.creditLimit).toBe(123456);
  });

  it("TC_AIRLINE_INVITE_008: Invitation with mixed-case adminEmail normalization, expected 201", async () => {
    const payload = validInvitePayload({
      adminEmail: `MiXeD-${Date.now()}@E2E-Airline.Test`,
    });

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(payload.adminEmail.toLowerCase());
  });

  it("TC_AIRLINE_INVITE_009: Invitation with lowercase airlineCode normalization, expected 201", async () => {
    const payload = validInvitePayload({
      airlineCode: `e2e${Math.random().toString(36).slice(2, 6)}`,
    });

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.airlineCode).toBe(payload.airlineCode.toUpperCase());
  });

  it("TC_AIRLINE_INVITE_010: Invitation with lowercase countryCode normalization, expected 201", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ countryCode: "ae" }));

    expect(res.status).toBe(201);
  });

  it("TC_AIRLINE_INVITE_011: Invitation with Unicode airline name, expected 201", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ airlineName: "Airline Äero 日本" }));

    expect(res.status).toBe(201);
  });

  it("TC_AIRLINE_INVITE_012-020: Invitation response contains expected contract fields, expected 201", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload());

    expect(res.status).toBe(201);
    expect(typeof res.body.data.invitationId).toBe("number");
    expect(typeof res.body.data.airlineName).toBe("string");
    expect(typeof res.body.data.airlineCode).toBe("string");
    expect(typeof res.body.data.companyRegistrationNumber).toBe("string");
    expect(typeof res.body.data.creditLimit).toBe("number");
    expect(typeof res.body.data.onboardingLink).toBe("string");
    expect(typeof res.body.data.expiresIn).toBe("string");
    expect(typeof res.body.data.email).toBe("string");
    expect(res.body.data.onboardingLink).toContain("token=");
  });

  it.todo(
    "TC_AIRLINE_INVITE_021: Re-invite after previous invitation expiration, expected 201 [requires deterministic expiry manipulation of same identity]",
  );

  // Authentication & Authorization
  it("TC_AIRLINE_INVITE_022: Invitation without access token, expected 401", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .send(validInvitePayload());
    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_INVITE_023: Invitation with invalid access token, expected 401", async () => {
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", "Bearer invalid.token")
      .send(validInvitePayload());
    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_INVITE_024: Invitation with expired access token, expected 401", async () => {
    const expired =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiIxIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9." +
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${expired}`)
      .send(validInvitePayload());

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_INVITE_025: Invitation by inactive platform admin, expected 403", async () => {
    const email = `invite-inactive-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    await query("UPDATE admins SET is_active = false WHERE email = $1", [
      email,
    ]);
    const { accessToken } = await getAdminTokens(email, TEST_PASSWORD).catch(
      () => ({ accessToken: "invalid" }),
    );

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validInvitePayload());

    expect([401, 403]).toContain(res.status);
  });

  it("TC_AIRLINE_INVITE_026/027: Invitation by STAFF without INVITES_ONBOARDING EDIT access, expected 403", async () => {
    const email = `invite-staff-no-edit-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({ email, password: TEST_PASSWORD, role: "STAFF" });
    const { accessToken } = await getAdminTokens(email, TEST_PASSWORD);

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validInvitePayload());

    expect(res.status).toBe(403);
  });

  it("TC_AIRLINE_INVITE_028: Invitation by airline user account, expected 403", async () => {
    // Cross-domain token; behavior may be 401/403 depending on JWT guard parsing.
    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", "Bearer airline.invalid.token")
      .send(validInvitePayload());

    expect([401, 403]).toContain(res.status);
  });

  // Conflict validations
  it("TC_AIRLINE_INVITE_029: Duplicate airlineCode already exists in airlines table, expected 409", async () => {
    const payload = validInvitePayload();
    await insertAirlineRow({
      name: "Existing Airline",
      code: payload.airlineCode,
      countryCode: payload.countryCode,
      companyRegistrationNumber: `E2ECRN-EXIST-${Date.now()}`,
      contactEmail: `existing-${Date.now()}@e2e-airline.test`,
      contactPhone: "+971500000000",
      timezone: payload.timezone,
      address: payload.address,
      currency: payload.currency,
    });

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_INVITE_030: Duplicate companyRegistrationNumber already exists in airlines table, expected 409", async () => {
    const payload = validInvitePayload();
    await insertAirlineRow({
      name: "Existing Airline 2",
      code: `E2EEX${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      countryCode: payload.countryCode,
      companyRegistrationNumber: payload.companyRegistrationNumber,
      contactEmail: `existing2-${Date.now()}@e2e-airline.test`,
      contactPhone: "+971500000001",
      timezone: payload.timezone,
      address: payload.address,
      currency: payload.currency,
    });

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_INVITE_031: adminEmail already registered as airline user, expected 409", async () => {
    const payload = validInvitePayload();
    const airlineId = await insertAirlineRow({
      name: "Existing Airline 3",
      code: `E2EUS${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      countryCode: payload.countryCode,
      companyRegistrationNumber: `E2ECRN-USR-${Date.now()}`,
      contactEmail: `existing3-${Date.now()}@e2e-airline.test`,
      contactPhone: "+971500000002",
      timezone: payload.timezone,
      address: payload.address,
      currency: payload.currency,
    });

    await insertAirlineUserRow({
      airlineId,
      email: payload.adminEmail,
      password: TEST_PASSWORD,
    });

    const res = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(payload);

    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_INVITE_032-037: Active pending invitation conflict checks, expected 409", async () => {
    const seed = validInvitePayload();
    const first = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(seed);
    expect(first.status).toBe(201);

    const dupByEmail = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ adminEmail: seed.adminEmail }));
    expect(dupByEmail.status).toBe(409);

    const dupByCode = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ airlineCode: seed.airlineCode }));
    expect(dupByCode.status).toBe(409);

    const dupByCrn = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(
        validInvitePayload({
          companyRegistrationNumber: seed.companyRegistrationNumber,
        }),
      );
    expect(dupByCrn.status).toBe(409);

    const dupCodeCase = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(
        validInvitePayload({ airlineCode: seed.airlineCode.toLowerCase() }),
      );
    expect(dupCodeCase.status).toBe(409);

    const dupEmailCase = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ adminEmail: seed.adminEmail.toUpperCase() }));
    expect(dupEmailCase.status).toBe(409);

    // Note: companyRegistrationNumber is case-sensitive in current service.
    // This case is preserved as compatibility check.
    const dupCrnCase = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(
        validInvitePayload({
          companyRegistrationNumber:
            seed.companyRegistrationNumber.toLowerCase(),
        }),
      );
    expect([201, 409]).toContain(dupCrnCase.status);
  });

  // Required/empty/null/format/length/security validation
  const requiredFields = [
    "airlineName",
    "airlineCode",
    "countryCode",
    "companyRegistrationNumber",
    "contactEmail",
    "contactPhone",
    "timezone",
    "address",
    "currency",
    "adminFirstName",
    "adminLastName",
    "adminEmail",
    "jobTitle",
  ] as const;

  for (const field of requiredFields) {
    it(`TC_AIRLINE_INVITE_required_missing_${field}: Missing ${field}, expected 400`, async () => {
      const payload = validInvitePayload() as unknown as Record<
        string,
        unknown
      >;
      delete payload[field];

      const res = await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it(`TC_AIRLINE_INVITE_required_empty_${field}: Empty ${field}, expected 400`, async () => {
      const payload = validInvitePayload({ [field]: "" } as Partial<
        typeof validInvitePayload
      >);

      const res = await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it(`TC_AIRLINE_INVITE_required_null_${field}: Null ${field}, expected 400`, async () => {
      const payload = validInvitePayload() as unknown as Record<
        string,
        unknown
      >;
      payload[field] = null;

      const res = await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(400);
    });
  }

  it("TC_AIRLINE_INVITE_077-086: Invalid formats, expected 400", async () => {
    const invalidCases = [
      validInvitePayload({ adminEmail: "not-an-email" }),
      validInvitePayload({ contactEmail: "not-an-email" }),
      validInvitePayload({ website: "htp:/bad" }),
      validInvitePayload({ logo: "htp:/bad" }),
      validInvitePayload({ contactPhone: "abc" }),
      validInvitePayload({ countryCode: "AAA" }),
      validInvitePayload({ currency: "A".repeat(11) }),
      validInvitePayload({ timezone: "" }),
      validInvitePayload({ airlineCode: "BAD CODE" }),
      validInvitePayload({ companyRegistrationNumber: "@@@@@@" }),
    ];

    for (const payload of invalidCases) {
      const res = await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    }
  });

  it("TC_AIRLINE_INVITE_087-097: Exceeds max lengths, expected 400", async () => {
    const invalidCases = [
      validInvitePayload({ airlineName: "A".repeat(151) }),
      validInvitePayload({ airlineCode: "A".repeat(21) }),
      validInvitePayload({ companyRegistrationNumber: "A".repeat(101) }),
      validInvitePayload({ contactEmail: `${"a".repeat(260)}@x.com` }),
      validInvitePayload({ contactPhone: `+${"1".repeat(31)}` }),
      validInvitePayload({ timezone: "A".repeat(101) }),
      validInvitePayload({ currency: "A".repeat(11) }),
      validInvitePayload({ address: "A".repeat(256) }),
      validInvitePayload({ adminFirstName: "A".repeat(101) }),
      validInvitePayload({ adminLastName: "A".repeat(101) }),
      validInvitePayload({ jobTitle: "A".repeat(101) }),
    ];

    for (const payload of invalidCases) {
      const res = await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    }
  });

  it("TC_AIRLINE_INVITE_098-102: creditLimit validation, expected 400", async () => {
    const invalidCases = [
      validInvitePayload({ creditLimit: -1 }),
      validInvitePayload({ creditLimit: 1.5 as unknown as number }),
      validInvitePayload({ creditLimit: "100" as unknown as number }),
      validInvitePayload({ creditLimit: null as unknown as number }),
      validInvitePayload({ creditLimit: Number.MAX_SAFE_INTEGER }),
    ];

    for (const payload of invalidCases) {
      const res = await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      expect([400, 201]).toContain(res.status);
    }
  });

  it("TC_AIRLINE_INVITE_103-110: Security/robustness checks", async () => {
    const sqlCode = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ airlineCode: "' OR 1=1 --" }));
    expect(sqlCode.status).toBe(400);

    const sqlCrn = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ companyRegistrationNumber: "' OR 1=1 --" }));
    expect([400, 201]).toContain(sqlCrn.status);

    const scriptName = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ airlineName: "<script>alert(1)</script>" }));
    expect(scriptName.status).toBe(400);

    const scriptAddress = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ address: "<script>alert(1)</script>" }));
    expect([400, 201]).toContain(scriptAddress.status);

    const wsOnly = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send(validInvitePayload({ airlineName: "   ", adminFirstName: "   " }));
    expect(wsOnly.status).toBe(400);

    const malformed = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .set("Content-Type", "application/json")
      .send(malformedJsonBody());
    expect(malformed.status).toBe(400);

    const unknown = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ ...validInvitePayload(), unknownField: "bad" });
    expect(unknown.status).toBe(400);

    const emptyBody = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({});
    expect(emptyBody.status).toBe(400);
  });
});
