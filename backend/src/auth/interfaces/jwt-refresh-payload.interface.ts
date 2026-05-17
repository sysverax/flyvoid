export interface JwtRefreshPayload {
  sub: number;
  type: "refresh";
  userType?: "PLATFORM" | "AIRLINE";
}
