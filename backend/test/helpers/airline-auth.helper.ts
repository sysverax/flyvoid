import { api } from "./http-client.helper";

export interface AirlineTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export async function getAirlineTokens(
  email: string,
  password: string,
): Promise<AirlineTokens> {
  const res = await api
    .post("/api/v1/auth/airline/signin")
    .send({ email, password });

  if (res.status !== 200 || !res.body?.data?.accessToken) {
    throw new Error(
      `getAirlineTokens: signin failed with ${res.status} - ${JSON.stringify(res.body)}`,
    );
  }

  return {
    accessToken: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string,
    accessTokenExpiresIn: res.body.data.accessTokenExpiresIn as string,
    refreshTokenExpiresIn: res.body.data.refreshTokenExpiresIn as string,
  };
}
