export const authFactory = {
  buildRefreshTokenPayload(refreshToken: string) {
    return { refreshToken };
  },

  buildSignoutPayload(refreshToken: string) {
    return { refreshToken };
  },
};
