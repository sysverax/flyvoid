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
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
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
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
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
    description:
      "Temporary endpoint to create platform admins. This endpoint will be removed after initial setup.",
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
    description: "Authenticate admin and return access/refresh tokens.",
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
    description:
      "Verifies 2FA challenge token and TOTP code, then returns access/refresh tokens.",
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
    description:
      "Completes mandatory first-login password reset using the resetPasswordToken returned by signin challenge.",
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
    description: `Initializes authenticator-app 2FA setup and returns setup secret + QR. Issuer is \"${config.auth.twoFactorIssuer}\". Requires userType=PLATFORM.`,
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
    description:
      "Enables authenticator-app 2FA using the current TOTP code. Requires userType=PLATFORM.",
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
    description:
      "Disables authenticator-app 2FA using a valid current TOTP code. Requires userType=PLATFORM.",
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
    description:
      "Recovers account access when authenticator app is unavailable by verifying email, password, and a recovery code. This disables 2FA and revokes active sessions.",
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

  @Post("airline-invitations")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Invite airline admin",
    description:
      "Platform admin creates an airline and invites its first airline admin using email. In local/dev/test, email is not sent and onboarding link is returned in response. Requires userType=PLATFORM.",
  })
  @ApiBody({
    description: "Airline admin invitation payload",
    type: AdminInviteAirlineAdminRequestDto,
  })
  @ApiCreatedResponse({
    description: "Invitation created successfully",
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
              example: "Airline admin invitation created",
            },
            data: { $ref: getSchemaPath(AdminInviteAirlineAdminResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema(
      "/api/v1/auth/admin/airline-invitations",
    ),
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/auth/admin/airline-invitations",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  @ApiConflictResponse({
    description: "Airline code/email conflict or active invite already exists",
    schema: createConflictErrorSchema(
      "/api/v1/auth/admin/airline-invitations",
      "Airline code already exists",
    ),
  })
  async inviteAirlineAdmin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminInviteAirlineAdminRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminInviteAirlineAdminResponseDto>> {
    const response = await this.authService.inviteAirlineAdmin(
      req.user,
      dto,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline admin invitation created",
    );
  }

  @Post("forgot-password/send-otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin forgot password send OTP",
    description: `Generates OTP for admin forgot password flow. In local/dev/test, OTP is ${config.auth.adminForgotPasswordOtpStatic} and email is not sent. In production, a 6-digit OTP is emailed via AWS SES. OTP expires in ${config.auth.adminForgotPasswordOtpExpiryMinutes} minutes. Maximum ${config.auth.adminForgotPasswordOtpSendLimit} send requests are allowed in ${config.auth.adminForgotPasswordOtpSendWindowMinutes} minutes.`,
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
              example: "If the email exists, OTP has been sent",
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
  async adminForgotPasswordSendOtp(
    @Body() dto: AdminForgotPasswordSendOtpRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.authService.adminForgotPasswordSendOtp(dto, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "If the email exists, OTP has been sent",
    );
  }

  @Post("forgot-password/verify-otp")
  @HttpCode(200)
  @ApiOperation({
    summary: "Admin forgot password verify OTP",
    description: `Verifies OTP for admin forgot password flow. OTP expires in ${config.auth.adminForgotPasswordOtpExpiryMinutes} minutes and allows maximum ${config.auth.adminForgotPasswordOtpMaxAttempts} failed attempts before invalidation.`,
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
    description: `Resets admin password using resetPasswordToken issued by verify-otp API. Reset token expires in ${config.auth.adminForgotPasswordResetTokenExpiresIn}.`,
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
    description:
      "Validates refresh token, rotates refresh token, and returns new access/refresh tokens.",
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
    description:
      "Revokes provided refresh token for currently authenticated admin. Requires userType=PLATFORM.",
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
