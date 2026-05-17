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
@Controller("auth/airline")
export class AirlineAuthController {
  constructor(private readonly airlineAuthService: AirlineAuthService) {}

  @Post("onboard")
  @HttpCode(200)
  @ApiOperation({
    summary: "Onboard airline admin",
    description:
      "Completes airline admin onboarding using invitation token from email link and sets initial password. This can be completed once per airline admin invitation.",
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
  @ApiOperation({ summary: "Airline signin" })
  @ApiBody({ type: AirlineSigninRequestDto })
  async signin(
    @Body() dto: AirlineSigninRequestDto,
    @RequestId() requestId: string,
  ): Promise<
    BaseResponseDto<
      AirlineSigninResponseDto | AirlineSigninTwoFactorChallengeResponseDto
    >
  > {
    const response = await this.airlineAuthService.signin(dto, requestId);
    return BaseResponseDto.success(response, requestId, "Signin successful");
  }

  @Post("signin/2fa/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Airline signin 2FA verify" })
  @ApiBody({ type: AirlineSigninTwoFactorVerifyRequestDto })
  async verifyTwoFactor(
    @Body() dto: AirlineSigninTwoFactorVerifyRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineSigninResponseDto>> {
    const response = await this.airlineAuthService.verifySigninTwoFactor(
      dto,
      requestId,
    );
    return BaseResponseDto.success(response, requestId, "Signin successful");
  }

  @Post("2fa/setup")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Airline 2FA setup" })
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
  @ApiOperation({ summary: "Airline 2FA enable" })
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
  @ApiOperation({ summary: "Airline 2FA disable" })
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
  @ApiOperation({ summary: "Airline 2FA recover" })
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
  @ApiOperation({ summary: "Airline forgot password send OTP" })
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
  @ApiOperation({ summary: "Airline forgot password verify OTP" })
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
  @ApiOperation({ summary: "Airline forgot password reset" })
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
  @ApiOperation({ summary: "Airline refresh" })
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
  @ApiOperation({ summary: "Airline signout" })
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
