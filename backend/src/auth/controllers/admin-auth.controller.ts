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
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiTags,
  getSchemaPath,
  ApiTooManyRequestsResponse,
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
import { UserType } from "../../common/constants/user.constants";
import { RequireUserTypes } from "../decorators/rbac.decorator";
import { config } from "../../config/config";
import {
  AdminInitialPasswordResetRequestDto,
  AdminForgotPasswordResetRequestDto,
  AdminForgotPasswordSendOtpRequestDto,
  AdminForgotPasswordVerifyOtpRequestDto,
  AdminForgotPasswordVerifyOtpResponseDto,
  AdminSigninRequestDto,
  AdminSigninPasswordResetChallengeResponseDto,
  AdminSigninResponseDto,
  AdminSigninTwoFactorChallengeResponseDto,
  AdminSigninTwoFactorVerifyRequestDto,
  AdminSignupRequestDto,
  AdminSignupResponseDto,
  AdminTwoFactorDisableRequestDto,
  AdminTwoFactorEnableRequestDto,
  AdminTwoFactorEnableResponseDto,
  AdminTwoFactorRecoverRequestDto,
  AdminTwoFactorSetupResponseDto,
  RefreshTokenRequestDto,
  SignoutRequestDto,
} from "../dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RbacGuard } from "../guards/rbac.guard";
import { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";
import { AuthService } from "../services/admin-auth.service";

@ApiExtraModels(
  BaseResponseDto,
  AdminTwoFactorSetupResponseDto,
  AdminTwoFactorEnableRequestDto,
  AdminTwoFactorEnableResponseDto,
  AdminTwoFactorDisableRequestDto,
  AdminTwoFactorRecoverRequestDto,
  AdminForgotPasswordSendOtpRequestDto,
  AdminForgotPasswordVerifyOtpRequestDto,
  AdminForgotPasswordVerifyOtpResponseDto,
  AdminInitialPasswordResetRequestDto,
  AdminForgotPasswordResetRequestDto,
  AdminSignupRequestDto,
  AdminSignupResponseDto,
  AdminSigninRequestDto,
  AdminSigninPasswordResetChallengeResponseDto,
  AdminSigninResponseDto,
  AdminSigninTwoFactorChallengeResponseDto,
  AdminSigninTwoFactorVerifyRequestDto,
  RefreshTokenRequestDto,
  SignoutRequestDto,
)
@ApiTags("Platform Admin Auth")
@Controller("auth/admin")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @ApiOperation({
    summary: "Admin signup (temporary)",
    description: `
    Temporary endpoint to bootstrap the first platform admin. Will be removed after initial setup.
      Access: Public endpoint — no authentication required.
      Business logic validations (409 Conflict):
        1. Email must not already be registered as an admin`,
  })
  @ApiBody({
    description: "Admin signup request payload",
    type: AdminSignupRequestDto,
  })
  @ApiCreatedResponse({
    description: "Admin created successfully",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Admin created successfully" },
            data: { $ref: getSchemaPath(AdminSignupResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/signup"),
  })
  @ApiConflictResponse({
    description: "Admin email already exists",
    schema: createConflictErrorSchema(
      "/api/v1/auth/admin/signup",
      "Admin already exists",
    ),
  })
  async adminSignup(
    @Body() dto: AdminSignupRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminSignupResponseDto>> {
    const createdAdmin = await this.authService.signup(dto, requestId);
    return BaseResponseDto.success(
      createdAdmin,
      requestId,
      "Admin registered successfully",
    );
  }

  @Post("signin")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin signin",
    description: `
    Authenticates a platform admin and returns tokens or a challenge response.
      Access: Public endpoint — no authentication required.
      Response variants:
        1. Tokens (accessToken + refreshToken) — on successful login with 2FA disabled
        2. requiresTwoFactor challenge — if 2FA is enabled; use signin/2fa/verify to complete
        3. requiresPasswordReset challenge — on first login with a temporary password; use signin/reset-password to complete
      Business logic validations:
        1. Credentials must be valid (401 if invalid email or password)`,
  })
  @ApiBody({
    description: "Admin signin request payload",
    type: AdminSigninRequestDto,
  })
  @ApiOkResponse({
    description: "Signin successful",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Signin successful" },
            data: {
              oneOf: [
                { $ref: getSchemaPath(AdminSigninResponseDto) },
                {
                  $ref: getSchemaPath(AdminSigninTwoFactorChallengeResponseDto),
                },
                {
                  $ref: getSchemaPath(
                    AdminSigninPasswordResetChallengeResponseDto,
                  ),
                },
              ],
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/signin"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid credentials",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/signin",
      "Invalid credentials",
    ),
  })
  async adminSignin(
    @Body() dto: AdminSigninRequestDto,
    @RequestId() requestId: string,
  ): Promise<
    BaseResponseDto<
      | AdminSigninResponseDto
      | AdminSigninTwoFactorChallengeResponseDto
      | AdminSigninPasswordResetChallengeResponseDto
    >
  > {
    const signinResponse = await this.authService.signin(dto, requestId);
    const message =
      "requiresPasswordReset" in signinResponse
        ? "Initial password reset required"
        : "requiresTwoFactor" in signinResponse
          ? "Signin requires two-factor authentication"
          : "Signin successful";
    return BaseResponseDto.success(signinResponse, requestId, message);
  }

  @Post("signin/2fa/verify")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin signin 2FA verify",
    description: `
    Completes the 2FA signin step using the challenge token from signin and the current TOTP code.
      Access: Public endpoint — challenge token from POST /auth/admin/signin required.
      Business logic validations:
        1. Challenge token must be valid and unexpired (401 if invalid)
        2. TOTP code must be correct (401 if invalid)`,
  })
  @ApiBody({
    description: "Admin signin 2FA verify payload",
    type: AdminSigninTwoFactorVerifyRequestDto,
  })
  @ApiOkResponse({
    description: "2FA verified and signin completed",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Signin successful" },
            data: {
              oneOf: [
                { $ref: getSchemaPath(AdminSigninResponseDto) },
                {
                  $ref: getSchemaPath(
                    AdminSigninPasswordResetChallengeResponseDto,
                  ),
                },
              ],
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/signin/2fa/verify"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid 2FA challenge or code",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/signin/2fa/verify",
      "Invalid 2FA code",
    ),
  })
  async adminSigninTwoFactorVerify(
    @Body() dto: AdminSigninTwoFactorVerifyRequestDto,
    @RequestId() requestId: string,
  ): Promise<
    BaseResponseDto<
      AdminSigninResponseDto | AdminSigninPasswordResetChallengeResponseDto
    >
  > {
    const signinResponse = await this.authService.verifyAdminSigninTwoFactor(
      dto,
      requestId,
    );
    const message =
      "requiresPasswordReset" in signinResponse
        ? "Initial password reset required"
        : "Signin successful";
    return BaseResponseDto.success(signinResponse, requestId, message);
  }

  @Post("signin/reset-password")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin initial password reset",
    description: `
    Completes the mandatory first-login password reset using the resetPasswordToken from the signin challenge.
      Access: Public endpoint — resetPasswordToken from POST /auth/admin/signin required.
      Business logic validations:
        1. resetPasswordToken must be valid and unexpired (401 if invalid)`,
  })
  @ApiBody({
    description: "Initial password reset payload",
    type: AdminInitialPasswordResetRequestDto,
  })
  @ApiOkResponse({
    description: "Initial password reset successful",
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
              example: "Initial password reset successful",
            },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema(
      "/api/v1/auth/admin/signin/reset-password",
    ),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired initial password reset token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/signin/reset-password",
      "Invalid or expired initial password reset token",
    ),
  })
  async adminInitialPasswordReset(
    @Body() dto: AdminInitialPasswordResetRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.adminInitialPasswordReset(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "Initial password reset successful",
    );
  }

  @Post("2fa/setup")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Admin 2FA setup",
    description: `
    Initializes authenticator-app 2FA setup and returns the setup secret and QR code for scanning.
      Issuer is "${config.auth.twoFactorIssuer}". Must call POST /auth/admin/2fa/enable with the generated TOTP code to activate.
      Access: Authenticated platform admin. Requires userType=PLATFORM.
      Business logic validations:
        1. 2FA must not already be enabled (409 Conflict)`,
  })
  @ApiOkResponse({
    description: "2FA setup initialized",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "2FA setup initialized" },
            data: { $ref: getSchemaPath(AdminTwoFactorSetupResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/2fa/setup",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  @ApiConflictResponse({
    description: "2FA already enabled",
    schema: createConflictErrorSchema(
      "/api/v1/auth/admin/2fa/setup",
      "2FA is already enabled",
    ),
  })
  async setupAdminTwoFactor(
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminTwoFactorSetupResponseDto>> {
    const setupResponse = await this.authService.setupAdminTwoFactor(
      req.user,
      requestId,
    );
    return BaseResponseDto.success(
      setupResponse,
      requestId,
      "2FA setup initialized",
    );
  }

  @Post("2fa/enable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Admin 2FA enable",
    description: `
    Enables authenticator-app 2FA by verifying the current TOTP code against the setup secret.
      Must be called after POST /auth/admin/2fa/setup to activate 2FA.
      Access: Authenticated platform admin. Requires userType=PLATFORM.
      Business logic validations:
        1. 2FA setup must have been initiated first (400 if setup missing)
        2. TOTP code must be valid (401 if invalid)`,
  })
  @ApiBody({
    description: "2FA enable request payload",
    type: AdminTwoFactorEnableRequestDto,
  })
  @ApiOkResponse({
    description: "2FA enabled successfully with recovery codes",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "2FA enabled successfully" },
            data: { $ref: getSchemaPath(AdminTwoFactorEnableResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed or setup missing",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/2fa/enable"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid 2FA code",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/2fa/enable",
      "Invalid 2FA code",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  async enableAdminTwoFactor(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminTwoFactorEnableRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminTwoFactorEnableResponseDto>> {
    const enableResponse = await this.authService.enableAdminTwoFactor(
      req.user,
      dto,
      requestId,
    );
    return BaseResponseDto.success(
      enableResponse,
      requestId,
      "2FA enabled successfully",
    );
  }

  @Post("2fa/disable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Admin 2FA disable",
    description: `
    Disables authenticator-app 2FA using a valid current TOTP code.
      Access: Authenticated platform admin. Requires userType=PLATFORM.
      Business logic validations:
        1. 2FA must be currently enabled (400 if not enabled)
        2. TOTP code must be valid (401 if invalid)`,
  })
  @ApiBody({
    description: "2FA disable request payload",
    type: AdminTwoFactorDisableRequestDto,
  })
  @ApiOkResponse({
    description: "2FA disabled successfully",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "2FA disabled successfully" },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed or 2FA not enabled",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/2fa/disable"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid 2FA code",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/2fa/disable",
      "Invalid 2FA code",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  async disableAdminTwoFactor(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminTwoFactorDisableRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.disableAdminTwoFactor(req.user, dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "2FA disabled successfully",
    );
  }

  @Post("2fa/recover")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin 2FA recover",
    description: `
    Recovers account access when the authenticator app is unavailable.
      Verifies email, password, and a one-time recovery code, then disables 2FA and revokes all active sessions.
      Access: Public endpoint — no authentication required.
      Business logic validations:
        1. Email and password must be valid (401 if invalid)
        2. Recovery code must be valid and unused (401 if invalid)`,
  })
  @ApiBody({
    description: "2FA recovery request payload",
    type: AdminTwoFactorRecoverRequestDto,
  })
  @ApiOkResponse({
    description: "2FA recovered successfully",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "2FA recovered successfully" },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/2fa/recover"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid recovery credentials",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/2fa/recover",
      "Invalid recovery credentials",
    ),
  })
  async recoverAdminTwoFactor(
    @Body() dto: AdminTwoFactorRecoverRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.recoverAdminTwoFactor(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "2FA recovered successfully",
    );
  }

  @Post("forgot-password/send-otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin forgot password send OTP",
    description: `
    Sends a one-time password (OTP) to the admin's registered email for the forgot-password flow.
      Returns success regardless of whether the email exists to prevent user enumeration.
      In local/dev/test environments, OTP is ${config.auth.adminForgotPasswordOtpStatic} and no email is sent.
      In production, a 6-digit OTP is delivered via AWS SES. OTP expires in ${config.auth.adminForgotPasswordOtpExpiryMinutes} minutes.
      Access: Public endpoint — no authentication required.
      Business logic validations:
        1. Maximum ${config.auth.adminForgotPasswordOtpSendLimit} send requests allowed per ${config.auth.adminForgotPasswordOtpSendWindowMinutes}-minute window (429 Too Many Requests)`,
  })
  @ApiBody({
    description: "Admin forgot password send OTP request",
    type: AdminForgotPasswordSendOtpRequestDto,
  })
  @ApiOkResponse({
    description: "OTP request accepted",
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
              example: "OTP sent successfully",
            },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema(
      "/api/v1/auth/admin/forgot-password/send-otp",
    ),
  })
  @ApiTooManyRequestsResponse({
    description: "OTP send limit exceeded",
    schema: createBadRequestErrorSchema(
      "/api/v1/auth/admin/forgot-password/send-otp",
    ),
  })
  async adminForgotPasswordSendOtp(
    @Body() dto: AdminForgotPasswordSendOtpRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.adminForgotPasswordSendOtp(dto, requestId);
    return BaseResponseDto.success(null, requestId, "OTP sent successfully");
  }

  @Post("forgot-password/verify-otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin forgot password verify OTP",
    description: `
    Verifies the OTP submitted for the forgot-password flow and returns a password reset token.
      Access: Public endpoint — no authentication required.
      Business logic validations:
        1. OTP must be valid and unexpired — expires after ${config.auth.adminForgotPasswordOtpExpiryMinutes} minutes (401 if invalid)
        2. Maximum ${config.auth.adminForgotPasswordOtpMaxAttempts} failed attempts allowed before the OTP is permanently invalidated (403 Forbidden)`,
  })
  @ApiBody({
    description: "Admin forgot password verify OTP request",
    type: AdminForgotPasswordVerifyOtpRequestDto,
  })
  @ApiOkResponse({
    description: "OTP verified successfully and reset password token issued",
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
              example: "OTP verified successfully",
            },
            data: {
              $ref: getSchemaPath(AdminForgotPasswordVerifyOtpResponseDto),
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema(
      "/api/v1/auth/admin/forgot-password/verify-otp",
    ),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired OTP",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/forgot-password/verify-otp",
      "Invalid or expired OTP",
    ),
  })
  @ApiForbiddenResponse({
    description: "Maximum OTP verification attempts exceeded",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/forgot-password/verify-otp",
      "Maximum OTP verification attempts exceeded",
    ),
  })
  async adminForgotPasswordVerifyOtp(
    @Body() dto: AdminForgotPasswordVerifyOtpRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminForgotPasswordVerifyOtpResponseDto>> {
    const verifyOtpResponse =
      await this.authService.adminForgotPasswordVerifyOtp(dto, requestId);
    return BaseResponseDto.success(
      verifyOtpResponse,
      requestId,
      "OTP verified successfully",
    );
  }

  @Post("forgot-password")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin forgot password reset",
    description: `
    Resets the admin's password using the resetPasswordToken issued by POST /auth/admin/forgot-password/verify-otp.
      Access: Public endpoint — resetPasswordToken from POST /auth/admin/forgot-password/verify-otp required.
      Business logic validations:
        1. resetPasswordToken must be valid and unexpired — expires in ${config.auth.adminForgotPasswordResetTokenExpiresIn} (401 if invalid)`,
  })
  @ApiBody({
    description: "Admin forgot password reset request",
    type: AdminForgotPasswordResetRequestDto,
  })
  @ApiOkResponse({
    description: "Password reset successful",
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
              example: "Password reset successful",
            },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/admin/forgot-password"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired reset password token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/forgot-password",
      "Invalid or expired reset password token",
    ),
  })
  async adminForgotPasswordReset(
    @Body() dto: AdminForgotPasswordResetRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.adminForgotPasswordReset(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "Password reset successful",
    );
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({
    summary: "Refresh token pair",
    description: `
    Validates the provided refresh token, rotates it, and returns a new access/refresh token pair.
      Access: Public endpoint — valid refresh token required in request body.
      Business logic validations:
        1. Refresh token must be valid and not revoked (401 if invalid or expired)`,
  })
  @ApiBody({
    description: "Refresh token request payload",
    type: RefreshTokenRequestDto,
  })
  @ApiOkResponse({
    description: "Token refreshed successfully",
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
              example: "Token refreshed successfully",
            },
            data: { $ref: getSchemaPath(AdminSigninResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/refresh"),
  })
  @ApiUnauthorizedResponse({
    description: "Invalid refresh token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/refresh",
      "Invalid refresh token",
    ),
  })
  async refreshToken(
    @Body() dto: RefreshTokenRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminSigninResponseDto>> {
    const refreshResponse = await this.authService.refreshToken(dto, requestId);
    return BaseResponseDto.success(
      refreshResponse,
      requestId,
      "Token refreshed successfully",
    );
  }

  @Post("signout")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Signout",
    description: `
    Revokes the provided refresh token, ending the current session.
      Access: Authenticated platform admin. Requires userType=PLATFORM.`,
  })
  @ApiBody({
    description: "Signout request payload",
    type: SignoutRequestDto,
  })
  @ApiOkResponse({
    description: "Signout successful",
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Signout successful" },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/auth/signout"),
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token or refresh token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/signout",
      "Invalid refresh token",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  async signout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SignoutRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.signout(req.user, dto, requestId);
    return BaseResponseDto.success(null, requestId, "Signout successful");
  }
}
