/**
 * Auth helper — black-box e2e only.
 *
 * Provides convenience functions for signing in and obtaining tokens by
 * calling the real running backend. Nothing is imported from src/.
 *
 * Usage:
 *   import { getAdminTokens } from '../helpers/auth.helper';
 *
 *   const { accessToken, refreshToken } = await getAdminTokens(email, password);
 */
import { api } from "./http-client.helper";

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

/**
 * Signs in the given admin and returns the token pair.
 * Throws if signin does not return 200 or data does not contain tokens.
 */
export async function getAdminTokens(
  email: string,
  password: string,
): Promise<AdminTokens> {
  const res = await api
    .post("/api/v1/auth/admin/signin")
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(
      `getAdminTokens: signin failed with ${res.status} — ${JSON.stringify(res.body)}`,
    );
  }

  const data = res.body?.data as Record<string, unknown>;

  if (!data?.accessToken) {
    throw new Error(
      `getAdminTokens: unexpected signin response shape — ${JSON.stringify(res.body)}`,
    );
  }

  return {
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    accessTokenExpiresIn: data.accessTokenExpiresIn as string,
    refreshTokenExpiresIn: data.refreshTokenExpiresIn as string,
  };
}

/**
 * Signs up a new admin via the real API, then signs in and returns tokens.
 * Throws on any non-201/200 status.
 */
export async function signupAndGetTokens(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<AdminTokens> {
  const signupRes = await api
    .post("/api/v1/auth/admin/signup")
    .send({ firstName, lastName, email, password });

  if (signupRes.status !== 201) {
    throw new Error(
      `signupAndGetTokens: signup failed with ${signupRes.status} — ${JSON.stringify(signupRes.body)}`,
    );
  }

  return getAdminTokens(email, password);
}
