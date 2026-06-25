/**
 * HTTP client helper — black-box e2e only.
 *
 * Returns a supertest agent pointed at process.env.BASE_URL.
 * Every spec file imports `api` and chains .post(), .get() etc. on it.
 *
 * Usage:
 *   import { api } from '../helpers/http-client.helper';
 *
 *   const res = await api
 *     .post('/api/v1/auth/admin/signup')
 *     .send({ firstName: 'John', ... });
 *   expect(res.status).toBe(201);
 */
import supertest from "supertest";

function getBaseUrl(): string {
  const url = process.env.BASE_URL;
  if (!url) {
    throw new Error(
      "BASE_URL is not set. Ensure jest.setup.ts has loaded automation_test.env.",
    );
  }
  return url;
}

export const api = supertest(getBaseUrl());
