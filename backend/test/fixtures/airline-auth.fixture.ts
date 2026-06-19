import { uniqueEmail } from "./admin.fixture";

export const AIRLINE_TEST_PASSWORD = "Password@123";
export const AIRLINE_NEW_PASSWORD = "NewPass@456";

export function uniqueAirlineEmail(prefix = "airline-user"): string {
  return uniqueEmail(prefix).replace("@e2e.test", "@e2e-airline-auth.test");
}

export function validAirlineSigninPayload(email: string, password: string) {
  return { email, password };
}

export function validOnboardPayload(
  invitationToken: string,
  password = AIRLINE_TEST_PASSWORD,
) {
  return { invitationToken, password };
}

export function validTwoFactorEnablePayload(twoFactorCode: string) {
  return { twoFactorCode };
}

export function validTwoFactorDisablePayload(twoFactorCode: string) {
  return { twoFactorCode };
}

export function validTwoFactorVerifyPayload(
  twoFactorToken: string,
  twoFactorCode: string,
) {
  return { twoFactorToken, twoFactorCode };
}

export function validTwoFactorRecoverPayload(
  email: string,
  password: string,
  recoveryCode: string,
) {
  return { email, password, recoveryCode };
}

export function validAirlineForgotPasswordSendOtpPayload(email: string) {
  return { email };
}

export function validAirlineForgotPasswordVerifyOtpPayload(
  email: string,
  otp: string,
) {
  return { email, otp };
}

export function validAirlineForgotPasswordResetPayload(
  resetPasswordToken: string,
  newPassword: string,
) {
  return { resetPasswordToken, newPassword };
}

export function validAirlineInitialPasswordResetPayload(
  resetPasswordToken: string,
  newPassword: string,
) {
  return { resetPasswordToken, newPassword };
}

export function refreshTokenPayload(refreshToken: string) {
  return { refreshToken };
}

export function signoutPayload(refreshToken: string) {
  return { refreshToken };
}
