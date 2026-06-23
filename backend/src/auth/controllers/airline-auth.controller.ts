import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
  getSchemaPath,
  ApiExtraModels,
} from "@nestjs/swagger";
import {
  REQUEST_ID_EXAMPLE,
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createConflictErrorSchema,
  createUnauthorizedErrorSchema,
} from "../../common/constants/swagger.constants";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import { RequestId } from "../../common/decorators/request-id.decorator";
import {
  AirlineInitialPasswordResetRequestDto,
  AirlineTwoFactorDisableRequestDto,
  AirlineTwoFactorEnableRequestDto,
  AirlineTwoFactorEnableResponseDto,
  AirlineTwoFactorRecoverRequestDto,
  AirlineTwoFactorSetupResponseDto,
  AirlineAdminOnboardRequestDto,
  AirlineAdminOnboardResponseDto,
  AirlineForgotPasswordResetRequestDto,
  AirlineForgotPasswordSendOtpRequestDto,
  AirlineForgotPasswordVerifyOtpRequestDto,
  AirlineForgotPasswordVerifyOtpResponseDto,
  AirlineSigninRequestDto,
  AirlineSigninPasswordResetChallengeResponseDto,
  AirlineSigninResponseDto,
  AirlineSigninTwoFactorChallengeResponseDto,
  AirlineSigninTwoFactorVerifyRequestDto,
  RefreshTokenRequestDto,
  SignoutRequestDto,
} from "../dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";
import { AirlineAuthService } from "../services/airline-auth.service";

@ApiTags("Airline Auth")
@ApiExtraModels(
  AirlineAdminOnboardResponseDto,
  AirlineSigninResponseDto,
  AirlineSigninTwoFactorChallengeResponseDto,
  AirlineSigninPasswordResetChallengeResponseDto,
  AirlineTwoFactorSetupResponseDto,
  AirlineTwoFactorEnableResponseDto,
)
@Controller("auth/airline")
export class AirlineAuthController {
  constructor(private readonly airlineAuthService: AirlineAuthService) {}

  @Post("onboard")
  @HttpCode(200)
  @ApiOperation({
    summary: "Onboard airline admin",
    description: `
    Completes airline admin onboarding using the invitation token from the email link and sets the initial password.
      Creates the airline and admin user records. Can only be completed once per invitation.
      Access: Public endpoint — valid invitation token required.
      Business logic validations:
        1. Invitation token must be valid, not expired, and not revoked (401 if invalid)
        2. Invitation must not already be accepted — no double onboarding (409 Conflict)
        3. Airline code from invitation must not already exist (409 Conflict)
        4. Company registration number from invitation must not already exist (409 Conflict)
        5. Admin email from invitation must not already be registered (409 Conflict)`,
  })
  @ApiBody({
    description: "Airline admin onboarding payload",
    type: AirlineAdminOnboardRequestDto,
  })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: {
              type: "string",
              example: "Airline admin onboarded successfully",
            },
            data: { $ref: getSchemaPath(AirlineAdminOnboardResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/auth/airline/onboard"),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/airline/onboard",
      "Invalid or expired invitation token",
    ),
  })
  @ApiConflictResponse({
    schema: createConflictErrorSchema(
      "/api/v1/auth/airline/onboard",
      "Airline admin already onboarded",
    ),
  })
  async onboardAirlineAdmin(
    @Body() dto: AirlineAdminOnboardRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineAdminOnboardResponseDto>> {
    const response = await this.airlineAuthService.onboardAirlineAdmin(
      dto,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "Airline admin onboarded successfully",
    );
  }

  @Post("signin")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline signin",
    description: `
    Authenticates an airline user and returns tokens or a 2FA challenge.
      Access: Public endpoint — no authentication required.
      Response variants:
        1. Tokens (accessToken + refreshToken) — on successful login with 2FA disabled
        2. requiresTwoFactor challenge — if 2FA is enabled; use signin/2fa/verify to complete
        3. requiresPasswordReset challenge — on first login with a temporary password; use signin/reset-password to complete
      Business logic validations:
        1. Credentials must be valid (401 if invalid email or password)
        2. Airline account must be active (401 if inactive)`,
  })
  @ApiBody({ type: AirlineSigninRequestDto })
  async signin(
    @Body() dto: AirlineSigninRequestDto,
    @RequestId() requestId: string,
  ): Promise<
    BaseResponseDto<
      | AirlineSigninResponseDto
      | AirlineSigninTwoFactorChallengeResponseDto
      | AirlineSigninPasswordResetChallengeResponseDto
    >
  > {
    const response = await this.airlineAuthService.signin(dto, requestId);
    const message =
      "requiresPasswordReset" in response
        ? "Initial password reset required"
        : "requiresTwoFactor" in response
          ? "Signin requires two-factor authentication"
          : "Signin successful";
    return BaseResponseDto.success(response, requestId, message);
  }

  @Post("signin/2fa/verify")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline signin 2FA verify",
    description: `
    Completes the 2FA signin step using the challenge token from signin and the current TOTP code.
      Access: Public endpoint — challenge token from POST /auth/airline/signin required.
      Business logic validations:
        1. Challenge token must be valid and unexpired (401 if invalid)
        2. TOTP code must be correct (401 if invalid)`,
  })
  @ApiBody({ type: AirlineSigninTwoFactorVerifyRequestDto })
  async verifyTwoFactor(
    @Body() dto: AirlineSigninTwoFactorVerifyRequestDto,
    @RequestId() requestId: string,
  ): Promise<
    BaseResponseDto<
      AirlineSigninResponseDto | AirlineSigninPasswordResetChallengeResponseDto
    >
  > {
    const response = await this.airlineAuthService.verifySigninTwoFactor(
      dto,
      requestId,
    );
    const message =
      "requiresPasswordReset" in response
        ? "Initial password reset required"
        : "Signin successful";
    return BaseResponseDto.success(response, requestId, message);
  }

  @Post("signin/reset-password")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline initial password reset",
    description: `
    Completes the mandatory first-login password reset using the resetPasswordToken from the signin challenge.
      Access: Public endpoint — resetPasswordToken from POST /auth/airline/signin required.
      Business logic validations:
        1. resetPasswordToken must be valid and unexpired (401 if invalid)`,
  })
  @ApiBody({ type: AirlineInitialPasswordResetRequestDto })
  async airlineInitialPasswordReset(
    @Body() dto: AirlineInitialPasswordResetRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineAuthService.airlineInitialPasswordReset(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "Initial password reset successful",
    );
  }

  @Post("2fa/setup")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Airline 2FA setup",
    description: `
    Initializes authenticator-app 2FA setup and returns a QR code and secret for scanning.
      Must call POST /auth/airline/2fa/enable with the generated TOTP to activate.
      Access: Authenticated airline user. Requires a valid access token.
      Business logic validations:
        1. 2FA must not already be enabled (409 Conflict)`,
  })
  async setupTwoFactor(
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineTwoFactorSetupResponseDto>> {
    const response = await this.airlineAuthService.setupTwoFactor(
      req.user,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "2FA setup initialized",
    );
  }

  @Post("2fa/enable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Airline 2FA enable",
    description: `
    Enables authenticator-app 2FA by verifying the current TOTP code against the setup secret.
      Must be called after POST /auth/airline/2fa/setup to activate 2FA.
      Access: Authenticated airline user. Requires a valid access token.
      Business logic validations:
        1. 2FA setup must have been initiated first (400 if setup missing)
        2. TOTP code must be valid (401 if invalid)`,
  })
  @ApiBody({ type: AirlineTwoFactorEnableRequestDto })
  async enableTwoFactor(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AirlineTwoFactorEnableRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineTwoFactorEnableResponseDto>> {
    const response = await this.airlineAuthService.enableTwoFactor(
      req.user,
      dto,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "2FA enabled successfully",
    );
  }

  @Post("2fa/disable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Airline 2FA disable",
    description: `
    Disables authenticator-app 2FA using a valid current TOTP code.
      Access: Authenticated airline user. Requires a valid access token.
      Business logic validations:
        1. 2FA must be currently enabled (400 if not enabled)
        2. TOTP code must be valid (401 if invalid)`,
  })
  @ApiBody({ type: AirlineTwoFactorDisableRequestDto })
  async disableTwoFactor(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AirlineTwoFactorDisableRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineAuthService.disableTwoFactor(req.user, dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "2FA disabled successfully",
    );
  }

  @Post("2fa/recover")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline 2FA recover",
    description: `
    Recovers account access when the authenticator app is unavailable.
      Verifies email, password, and a one-time recovery code, then disables 2FA and revokes all active sessions.
      Access: Public endpoint — no authentication required.
      Business logic validations:
        1. Email and password must be valid (401 if invalid)
        2. Recovery code must be valid and unused (401 if invalid)`,
  })
  @ApiBody({ type: AirlineTwoFactorRecoverRequestDto })
  async recoverTwoFactor(
    @Body() dto: AirlineTwoFactorRecoverRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineAuthService.recoverTwoFactor(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "2FA recovered successfully",
    );
  }

  @Post("forgot-password/send-otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline forgot password send OTP",
    description: `
    Sends a password reset OTP to the registered email address.
      Returns success regardless of whether the email exists to prevent user enumeration.
      Access: Public endpoint — no authentication required.`,
  })
  @ApiBody({ type: AirlineForgotPasswordSendOtpRequestDto })
  async forgotPasswordSendOtp(
    @Body() dto: AirlineForgotPasswordSendOtpRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineAuthService.forgotPasswordSendOtp(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "If the email exists, OTP has been sent",
    );
  }

  @Post("forgot-password/verify-otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline forgot password verify OTP",
    description: `
    Verifies the OTP submitted for the forgot-password flow and returns a password reset token.
      Access: Public endpoint — no authentication required.
      Business logic validations:
        1. OTP must be valid and unexpired (401 if invalid)
        2. Too many failed attempts will invalidate the OTP`,
  })
  @ApiBody({ type: AirlineForgotPasswordVerifyOtpRequestDto })
  async forgotPasswordVerifyOtp(
    @Body() dto: AirlineForgotPasswordVerifyOtpRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineForgotPasswordVerifyOtpResponseDto>> {
    const response = await this.airlineAuthService.forgotPasswordVerifyOtp(
      dto,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "OTP verified successfully",
    );
  }

  @Post("forgot-password")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline forgot password reset",
    description: `
    Resets the airline user's password using the token issued by verify-otp.
      Access: Public endpoint — resetPasswordToken from POST /auth/airline/forgot-password/verify-otp required.
      Business logic validations:
        1. resetPasswordToken must be valid and unexpired (401 if invalid)`,
  })
  @ApiBody({ type: AirlineForgotPasswordResetRequestDto })
  async forgotPasswordReset(
    @Body() dto: AirlineForgotPasswordResetRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineAuthService.forgotPasswordReset(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "Password reset successful",
    );
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({
    summary: "Airline refresh",
    description: `
    Validates the provided refresh token, rotates it, and returns a new access/refresh token pair.
      Access: Public endpoint — valid refresh token required in request body.
      Business logic validations:
        1. Refresh token must be valid and not revoked (401 if invalid or expired)`,
  })
  @ApiBody({ type: RefreshTokenRequestDto })
  async refresh(
    @Body() dto: RefreshTokenRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineSigninResponseDto>> {
    const response = await this.airlineAuthService.refresh(dto, requestId);
    return BaseResponseDto.success(
      response,
      requestId,
      "Token refreshed successfully",
    );
  }

  @Post("signout")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Airline signout",
    description: `
    Revokes the provided refresh token, ending the current session.
      Access: Authenticated airline user. Requires a valid access token.`,
  })
  @ApiBody({ type: SignoutRequestDto })
  async signout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SignoutRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineAuthService.signout(req.user, dto, requestId);
    return BaseResponseDto.success(null, requestId, "Signout successful");
  }
}
