import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import * as QRCode from "qrcode";
import * as speakeasy from "speakeasy";
import { AdminEntity } from "../../admin/entities/admin.entity";
import { AdminRole, UserType } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
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
import { JwtAccessPayload } from "../interfaces/jwt-access-payload.interface";
import { JwtRefreshPayload } from "../interfaces/jwt-refresh-payload.interface";
import { AuthenticatedUser } from "../interfaces/authenticated-request.interface";
import { AuthRepository } from "../repositories/auth.repository";
import {
  AccessAction,
  PlatformAsset,
  UserAccessControlEntry,
} from "../../common/constants/access-control.constants";
import { AdminProfileDto } from "../../admin/dto";
import { Logger } from "winston";

@Injectable()
export class AuthService {
  private readonly context = "AuthService";
  private readonly accessTokenExpiresIn = this.getJwtDuration(
    config.jwt.accessExpiresIn,
  );
  private readonly refreshTokenExpiresIn = this.getJwtDuration(
    config.jwt.refreshExpiresIn,
  );
  private readonly sesClient = new SESClient({
    region: config.ses.region,
    credentials: {
      accessKeyId: config.ses.accessKeyId,
      secretAccessKey: config.ses.secretAccessKey,
    },
  });

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async signup(
    dto: AdminSignupRequestDto,
    logger: Logger,
  ): Promise<AdminSignupResponseDto> {
    logger.info("Admin signup attempt", {
      email: dto.email,
      role: AdminRole.SUPER_ADMIN,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingAdmin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      logger,
    );

    if (existingAdmin) {
      logger.warn("Duplicate admin email on signup", {
        context: this.context,
        email: normalizedEmail,
      });
      throw new ConflictException("Admin with this email already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const createdAdmin =
      await this.authRepository.createAdminWithPlatformAccessControls(
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: normalizedEmail,
          passwordHash,
          role: AdminRole.SUPER_ADMIN,
          isActive: true,
          requirePasswordReset: false,
        },
        this.buildSuperAdminAccessControls(),
        logger,
      );

    logger.info("Admin signup success", {
      context: this.context,
      adminId: createdAdmin.id,
      email: createdAdmin.email,
    });

    return {
      id: createdAdmin.id,
      email: createdAdmin.email,
      role: createdAdmin.role,
    };
  }

  async signin(
    dto: AdminSigninRequestDto,
    logger: Logger,
  ): Promise<
    | AdminSigninResponseDto
    | AdminSigninTwoFactorChallengeResponseDto
    | AdminSigninPasswordResetChallengeResponseDto
  > {
    logger.info("Admin signin attempt", {
      email: dto.email,
      context: this.context,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      logger,
    );

    if (!admin || !admin.isActive) {
      logger.warn("Admin signin invalid credentials", {
        context: this.context,
        email: normalizedEmail,
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!isPasswordValid) {
      logger.warn("Admin signin invalid credentials", {
        context: this.context,
        email: normalizedEmail,
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (admin.twoFactorEnabled) {
      if (!admin.twoFactorSecretEncrypted) {
        logger.error("Admin has 2FA enabled but secret is missing", {
          context: this.context,
          adminId: admin.id,
        });
        throw new UnauthorizedException("2FA setup is invalid");
      }

      const twoFactorToken = await this.jwtService.signAsync(
        {
          sub: admin.id,
          userType: UserType.PLATFORM,
          type: "admin_2fa_challenge",
        },
        {
          secret: config.jwt.accessSecret,
          expiresIn: this.getJwtDuration(
            config.auth.twoFactorChallengeTokenExpiresIn,
          ),
        },
      );

      logger.info("Admin signin requires 2FA verification", {
        context: this.context,
        adminId: admin.id,
      });

      return {
        requiresTwoFactor: true,
        twoFactorToken,
        twoFactorTokenExpiresIn: config.auth.twoFactorChallengeTokenExpiresIn,
        admin: this.toAdminProfile(admin),
      };
    }

    if (admin.requirePasswordReset) {
      return this.buildInitialPasswordResetChallenge(admin);
    }

    return this.issueSessionTokens(admin, logger);
  }

  async verifyAdminSigninTwoFactor(
    dto: AdminSigninTwoFactorVerifyRequestDto,
    logger: Logger,
  ): Promise<
    AdminSigninResponseDto | AdminSigninPasswordResetChallengeResponseDto
  > {
    logger.info("Admin 2FA signin verification attempt", {
      context: this.context,
    });

    const payload = await this.verifyAdminTwoFactorChallengeToken(
      dto.twoFactorToken,
    );
    const admin = await this.authRepository.findAdminById(payload.sub, logger);

    if (
      !admin ||
      !admin.isActive ||
      !admin.twoFactorEnabled ||
      !admin.twoFactorSecretEncrypted
    ) {
      throw new UnauthorizedException("Invalid 2FA verification request");
    }

    const secret = this.decryptTwoFactorSecret(admin.twoFactorSecretEncrypted);
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);

    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    if (admin.requirePasswordReset) {
      return this.buildInitialPasswordResetChallenge(admin);
    }

    return this.issueSessionTokens(admin, logger);
  }

  async adminInitialPasswordReset(
    dto: AdminInitialPasswordResetRequestDto,
    logger: Logger,
  ): Promise<void> {
    const payload = await this.verifyAdminInitialPasswordResetToken(
      dto.resetPasswordToken,
    );

    const admin = await this.authRepository.findAdminById(payload.sub, logger);
    if (!admin || !admin.isActive || !admin.requirePasswordReset) {
      throw new UnauthorizedException(
        "Invalid or expired initial password reset token",
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.authRepository.updateAdminPasswordHash(
      admin.id,
      newPasswordHash,
      logger,
    );
    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      logger,
    );
  }

  async setupAdminTwoFactor(
    authenticatedUser: AuthenticatedUser,
    logger: Logger,
  ): Promise<AdminTwoFactorSetupResponseDto> {
    const admin = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      logger,
    );

    if (!admin) {
      throw new UnauthorizedException("Admin not found");
    }
    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    if (admin.twoFactorEnabled) {
      throw new ConflictException("2FA is already enabled");
    }

    const generatedSecret = speakeasy.generateSecret({
      name: `${config.auth.twoFactorIssuer}:${admin.email}`,
      issuer: config.auth.twoFactorIssuer,
      length: 20,
    });

    if (!generatedSecret.base32 || !generatedSecret.otpauth_url) {
      throw new BadRequestException("Unable to generate 2FA setup secret");
    }

    await this.authRepository.saveAdminTwoFactorTempSecret(
      admin.id,
      this.encryptTwoFactorSecret(generatedSecret.base32),
      logger,
    );

    const qrCodeDataUrl = await QRCode.toDataURL(generatedSecret.otpauth_url);

    return {
      manualEntryKey: generatedSecret.base32,
      qrCodeDataUrl,
    };
  }

  async enableAdminTwoFactor(
    authenticatedUser: AuthenticatedUser,
    dto: AdminTwoFactorEnableRequestDto,
    logger: Logger,
  ): Promise<AdminTwoFactorEnableResponseDto> {
    const admin = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      logger,
    );

    if (!admin) {
      throw new UnauthorizedException("Admin not found");
    }
    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    if (admin.twoFactorEnabled) {
      throw new ConflictException("2FA is already enabled");
    }

    if (!admin.twoFactorTempSecretEncrypted) {
      throw new BadRequestException("2FA setup has not been initialized");
    }

    const secret = this.decryptTwoFactorSecret(
      admin.twoFactorTempSecretEncrypted,
    );
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);
    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    const recoveryCodes = this.generateTwoFactorRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.authRepository.enableAdminTwoFactor(
      admin.id,
      this.encryptTwoFactorSecret(secret),
      recoveryCodeHashes,
      logger,
    );

    return { recoveryCodes };
  }

  async disableAdminTwoFactor(
    authenticatedUser: AuthenticatedUser,
    dto: AdminTwoFactorDisableRequestDto,
    logger: Logger,
  ): Promise<void> {
    const admin = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      logger,
    );

    if (!admin) {
      throw new UnauthorizedException("Admin not found");
    }
    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    if (!admin.twoFactorEnabled || !admin.twoFactorSecretEncrypted) {
      throw new BadRequestException("2FA is not enabled");
    }

    const secret = this.decryptTwoFactorSecret(admin.twoFactorSecretEncrypted);
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);
    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    await this.authRepository.disableAdminTwoFactor(admin.id, logger);
  }

  async recoverAdminTwoFactor(
    dto: AdminTwoFactorRecoverRequestDto,
    logger: Logger,
  ): Promise<void> {
    logger.info("Admin 2FA recovery attempt", {
      context: this.context,
      email: dto.email,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      logger,
    );

    if (!admin) {
      logger.error("Admin not found", {
        context: this.context,
        email: dto.email,
      });
      throw new UnauthorizedException("Admin not found");
    }
    if (!admin.isActive) {
      logger.error("Admin account is inactive", {
        context: this.context,
        email: dto.email,
      });
      throw new ForbiddenException("Admin account is inactive");
    }
    if (
      !admin.twoFactorEnabled ||
      !admin.twoFactorRecoveryCodeHashes ||
      admin.twoFactorRecoveryCodeHashes.length === 0
    ) {
      logger.error("Invalid recovery credentials", {
        context: this.context,
        email: dto.email,
      });
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!isPasswordValid) {
      logger.error("Invalid recovery credentials", {
        context: this.context,
        email: dto.email,
      });
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    const matchedIndex = await this.findMatchingRecoveryCodeIndex(
      dto.recoveryCode.trim().toUpperCase(),
      admin.twoFactorRecoveryCodeHashes,
    );

    if (matchedIndex === -1) {
      logger.error("Invalid recovery credentials", {
        context: this.context,
        email: dto.email,
      });
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    await this.authRepository.disableAdminTwoFactor(admin.id, logger);
    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      logger,
    );

    logger.warn("Admin 2FA recovered and disabled", {
      context: this.context,
      adminId: admin.id,
      usedRecoveryCodeIndex: matchedIndex,
    });
  }

  private async issueSessionTokens(
    admin: AdminEntity,
    logger: Logger,
  ): Promise<AdminSigninResponseDto> {
    const accessTokenPayload: JwtAccessPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      userType: UserType.PLATFORM,
      type: "access",
    };
    const refreshTokenPayload: JwtRefreshPayload = {
      sub: admin.id,
      userType: UserType.PLATFORM,
      type: "refresh",
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: config.jwt.accessSecret,
        expiresIn: this.accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: config.jwt.refreshSecret,
        expiresIn: this.refreshTokenExpiresIn,
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.durationToMs(config.jwt.refreshExpiresIn),
    );

    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      logger,
    );
    await this.authRepository.saveRefreshToken(
      admin.id,
      refreshTokenHash,
      refreshTokenExpiresAt,
      logger,
    );
    await this.authRepository.updateLastLogin(admin.id, new Date(), logger);
    const accessControls =
      await this.authRepository.findPlatformAccessControlsByAdminId(
        admin.id,
        logger,
      );

    logger.info("Admin signin success", {
      context: this.context,
      adminId: admin.id,
      email: admin.email,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.jwt.accessExpiresIn,
      refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
      admin: this.toAdminProfile(admin, accessControls),
    };
  }

  async refreshToken(
    dto: RefreshTokenRequestDto,
    logger: Logger,
  ): Promise<AdminSigninResponseDto> {
    logger.info("Refresh token attempt", {
      context: this.context,
    });

    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const adminId = payload.sub;

    const admin = await this.authRepository.findAdminById(adminId, logger);
    if (!admin) {
      logger.warn("Invalid refresh token", {
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (!admin.isActive) {
      logger.warn("Inactive admin on refresh token", {
        context: this.context,
        adminId,
      });
      throw new ForbiddenException("Invalid refresh token");
    }

    const existingToken =
      await this.authRepository.findActiveRefreshTokenByAdminId(
        adminId,
        logger,
      );

    if (!existingToken) {
      logger.warn("Invalid refresh token", {
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(
      dto.refreshToken,
      existingToken.tokenHash,
    );
    if (!isMatch) {
      logger.warn("Invalid refresh token", {
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.authRepository.revokeRefreshToken(existingToken.id, logger);

    const accessTokenPayload: JwtAccessPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      userType: UserType.PLATFORM,
      type: "access",
    };
    const refreshTokenPayload: JwtRefreshPayload = {
      sub: admin.id,
      userType: UserType.PLATFORM,
      type: "refresh",
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: config.jwt.accessSecret,
        expiresIn: this.accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: config.jwt.refreshSecret,
        expiresIn: this.refreshTokenExpiresIn,
      }),
    ]);

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const newRefreshTokenExpiresAt = new Date(
      Date.now() + this.durationToMs(config.jwt.refreshExpiresIn),
    );

    await this.authRepository.saveRefreshToken(
      admin.id,
      newRefreshTokenHash,
      newRefreshTokenExpiresAt,
      logger,
    );

    logger.info("Refresh token success", {
      context: this.context,
      adminId: admin.id,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresIn: config.jwt.accessExpiresIn,
      refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
      admin: {
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        role: admin.role,
        accessControls: [],
      },
    };
  }

  async signout(
    authenticatedUser: AuthenticatedUser,
    dto: SignoutRequestDto,
    logger: Logger,
  ): Promise<void> {
    const adminId = authenticatedUser.sub;
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (payload.sub !== adminId) {
      logger.warn("Invalid refresh token on signout", {
        context: this.context,
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const existingToken =
      await this.authRepository.findActiveRefreshTokenByAdminId(
        adminId,
        logger,
      );

    if (!existingToken) {
      logger.warn("Invalid refresh token on signout", {
        context: this.context,
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(
      dto.refreshToken,
      existingToken.tokenHash,
    );
    if (!isMatch) {
      logger.warn("Invalid refresh token on signout", {
        context: this.context,
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.authRepository.revokeRefreshToken(existingToken.id, logger);

    logger.info("Admin signout success", {
      context: this.context,
      adminId,
    });
  }

  async adminForgotPasswordSendOtp(
    dto: AdminForgotPasswordSendOtpRequestDto,
    logger: Logger,
  ): Promise<void> {
    logger.info("Admin forgot password send OTP attempt", {
      context: this.context,
      email: dto.email,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      logger,
    );

    if (!admin) {
      logger.info(
        "Admin forgot password send OTP accepted with no active admin match",
        {
          context: this.context,
          email: normalizedEmail,
        },
      );
      throw new UnauthorizedException("Admin not found");
    }

    if (!admin.isActive) {
      logger.warn("Inactive admin forgot password OTP attempt", {
        context: this.context,
        adminId: admin.id,
        email: normalizedEmail,
      });
      throw new ForbiddenException("Admin account is inactive");
    }

    const recentOtpCount =
      await this.authRepository.countRecentAdminForgotPasswordOtps(
        admin.id,
        new Date(
          Date.now() -
            config.auth.adminForgotPasswordOtpSendWindowMinutes * 60 * 1000,
        ),
        logger,
      );

    if (recentOtpCount >= config.auth.adminForgotPasswordOtpSendLimit) {
      logger.warn("Admin forgot password OTP send limit reached", {
        context: this.context,
        adminId: admin.id,
        sendLimit: config.auth.adminForgotPasswordOtpSendLimit,
      });
      throw new HttpException(
        "Too many OTP requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.isOtpRestrictedEnvironment()
      ? config.auth.adminForgotPasswordOtpStatic
      : this.generateSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(
      Date.now() + config.auth.adminForgotPasswordOtpExpiryMinutes * 60 * 1000,
    );

    await this.authRepository.invalidateActiveAdminForgotPasswordOtpsByAdminId(
      admin.id,
      logger,
    );
    await this.authRepository.saveAdminForgotPasswordOtp(
      admin.id,
      otpHash,
      expiresAt,
      logger,
    );

    if (this.isOtpRestrictedEnvironment()) {
      logger.info(
        "Admin forgot password OTP generated in non-production mode",
        {
          context: this.context,
          adminId: admin.id,
          otp,
        },
      );
      return;
    }

    await this.sendAdminForgotPasswordOtpEmail(admin.email, otp, logger);

    logger.info("Admin forgot password OTP email sent", {
      context: this.context,
      adminId: admin.id,
      email: admin.email,
    });
  }

  async adminForgotPasswordVerifyOtp(
    dto: AdminForgotPasswordVerifyOtpRequestDto,
    logger: Logger,
  ): Promise<AdminForgotPasswordVerifyOtpResponseDto> {
    logger.info("Admin forgot password verify OTP attempt", {
      context: this.context,
      email: dto.email,
    });

    const admin = await this.authRepository.findAdminByEmail(
      dto.email.toLowerCase().trim(),
      logger,
    );

    if (!admin) {
      throw new UnauthorizedException("Admin not found");
    }
    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    const activeOtp =
      await this.authRepository.findActiveAdminForgotPasswordOtpByAdminId(
        admin.id,
        logger,
      );

    if (!activeOtp) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    if (
      activeOtp.attemptCount >= config.auth.adminForgotPasswordOtpMaxAttempts
    ) {
      await this.authRepository.markAdminForgotPasswordOtpUsed(
        activeOtp.id,
        logger,
      );
      logger.warn("Admin forgot password OTP max attempts reached", {
        context: this.context,
        adminId: admin.id,
        otpId: activeOtp.id,
      });
      throw new ForbiddenException(
        "Maximum OTP verification attempts exceeded. Please request a new OTP.",
      );
    }

    const isOtpValid = await bcrypt.compare(dto.otp, activeOtp.otpHash);
    if (!isOtpValid) {
      await this.authRepository.incrementAdminForgotPasswordOtpAttempts(
        activeOtp.id,
        activeOtp.attemptCount,
        logger,
      );
      logger.warn("Admin forgot password OTP invalid attempt", {
        context: this.context,
        adminId: admin.id,
        otpId: activeOtp.id,
      });
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    await this.authRepository.markAdminForgotPasswordOtpVerified(
      activeOtp.id,
      logger,
    );

    const resetPasswordToken = await this.jwtService.signAsync(
      {
        sub: admin.id,
        otpId: activeOtp.id,
        type: "admin_forgot_password_reset",
      },
      {
        secret: config.jwt.accessSecret,
        expiresIn: this.getJwtDuration(
          config.auth.adminForgotPasswordResetTokenExpiresIn,
        ),
      },
    );

    return {
      resetPasswordToken,
      resetPasswordTokenExpiresIn:
        config.auth.adminForgotPasswordResetTokenExpiresIn,
    };
  }

  async adminForgotPasswordReset(
    dto: AdminForgotPasswordResetRequestDto,
    logger: Logger,
  ): Promise<void> {
    logger.info("Admin forgot password reset attempt", {
      context: this.context,
    });

    const payload = await this.verifyAdminForgotPasswordResetToken(
      dto.resetPasswordToken,
    );
    const admin = await this.authRepository.findAdminById(payload.sub, logger);
    if (!admin) {
      throw new UnauthorizedException(
        "Invalid or expired reset password token",
      );
    }
    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    const otpRecord = await this.authRepository.findAdminForgotPasswordOtpById(
      payload.otpId,
      logger,
    );

    if (
      !otpRecord ||
      otpRecord.adminId !== admin.id ||
      otpRecord.isUsed ||
      !otpRecord.isVerified ||
      otpRecord.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        "Invalid or expired reset password token",
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.authRepository.updateAdminPasswordHash(
      admin.id,
      newPasswordHash,
      logger,
    );
    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      logger,
    );
    await this.authRepository.markAdminForgotPasswordOtpUsed(
      otpRecord.id,
      logger,
    );

    logger.info("Admin forgot password reset success", {
      context: this.context,
      adminId: admin.id,
    });
  }

  private async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        token,
        {
          secret: config.jwt.refreshSecret,
        },
      );

      if (
        payload.type !== "refresh" ||
        payload.userType !== UserType.PLATFORM
      ) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async verifyAdminForgotPasswordResetToken(
    token: string,
  ): Promise<{ sub: number; otpId: number; type: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        otpId: number;
        type: string;
      }>(token, {
        secret: config.jwt.accessSecret,
      });

      if (payload.type !== "admin_forgot_password_reset") {
        throw new UnauthorizedException(
          "Invalid or expired reset password token",
        );
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired reset password token",
      );
    }
  }

  private async verifyAdminInitialPasswordResetToken(
    token: string,
  ): Promise<{ sub: number; type: string; userType?: UserType }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        type: string;
        userType?: UserType;
      }>(token, {
        secret: config.jwt.accessSecret,
      });

      if (
        payload.type !== "admin_initial_password_reset" ||
        payload.userType !== UserType.PLATFORM
      ) {
        throw new UnauthorizedException(
          "Invalid or expired initial password reset token",
        );
      }

      return payload;
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired initial password reset token",
      );
    }
  }

  private async verifyAdminTwoFactorChallengeToken(
    token: string,
  ): Promise<{ sub: number; type: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        userType?: UserType;
        type: string;
      }>(token, {
        secret: config.jwt.accessSecret,
      });

      if (
        payload.type !== "admin_2fa_challenge" ||
        payload.userType !== UserType.PLATFORM
      ) {
        throw new UnauthorizedException("Invalid 2FA verification request");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Invalid 2FA verification request");
    }
  }

  private verifyTwoFactorCode(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: code,
      window: config.auth.twoFactorOtpWindow,
    });
  }

  private encryptTwoFactorSecret(secret: string): string {
    const key = this.getTwoFactorEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  private decryptTwoFactorSecret(payload: string): string {
    const [ivHex, authTagHex, encryptedHex] = payload.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new BadRequestException("Invalid stored 2FA secret format");
    }

    const key = this.getTwoFactorEncryptionKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  private getTwoFactorEncryptionKey(): Buffer {
    const keyHex = config.auth.twoFactorEncryptionKey;
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new BadRequestException("Invalid TWO_FACTOR_ENCRYPTION_KEY value");
    }

    return Buffer.from(keyHex, "hex");
  }

  private toAdminProfile(
    admin: AdminEntity,
    accessControls?: UserAccessControlEntry[],
  ): AdminProfileDto {
    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      accessControls: (accessControls ?? []).map((ac) => ({
        asset: ac.moduleKey as PlatformAsset,
        access: ac.permissions as AccessAction[],
      })),
    };
  }

  private buildSuperAdminAccessControls(): Array<{
    asset: PlatformAsset;
    access: AccessAction[];
  }> {
    const allActions = Object.values(AccessAction);

    return Object.values(PlatformAsset).map((asset) => ({
      asset,
      access: allActions,
    }));
  }

  private async buildInitialPasswordResetChallenge(
    admin: AdminEntity,
  ): Promise<AdminSigninPasswordResetChallengeResponseDto> {
    const resetPasswordToken = await this.jwtService.signAsync(
      {
        sub: admin.id,
        userType: UserType.PLATFORM,
        type: "admin_initial_password_reset",
      },
      {
        secret: config.jwt.accessSecret,
        expiresIn: this.getJwtDuration(
          config.auth.adminInitialPasswordResetTokenExpiresIn,
        ),
      },
    );

    return {
      requiresPasswordReset: true,
      resetPasswordToken,
      resetPasswordTokenExpiresIn:
        config.auth.adminInitialPasswordResetTokenExpiresIn,
      admin: this.toAdminProfile(admin),
    };
  }

  private generateTwoFactorRecoveryCodes(): string[] {
    const codeCount = 8;
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    return Array.from({ length: codeCount }, () => {
      let code = "";
      for (let index = 0; index < 10; index += 1) {
        const random = crypto.randomInt(0, charset.length);
        code += charset[random];
      }
      return code;
    });
  }

  private async findMatchingRecoveryCodeIndex(
    recoveryCode: string,
    hashes: string[],
  ): Promise<number> {
    for (let index = 0; index < hashes.length; index += 1) {
      const isMatch = await bcrypt.compare(recoveryCode, hashes[index]);
      if (isMatch) {
        return index;
      }
    }

    return -1;
  }

  private durationToMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  private getJwtDuration(
    duration: string,
  ): `${number}${"s" | "m" | "h" | "d"}` {
    const normalized = duration.trim();
    if (!/^(\d+)([smhd])$/.test(normalized)) {
      throw new Error(`Invalid JWT duration format: ${duration}`);
    }

    return normalized as `${number}${"s" | "m" | "h" | "d"}`;
  }

  private isOtpRestrictedEnvironment(): boolean {
    return ["dev", "development", "local", "test", "automation_test"].includes(
      config.app.env,
    );
  }

  private generateSixDigitOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendAdminForgotPasswordOtpEmail(
    recipientEmail: string,
    otp: string,
    logger: Logger,
  ): Promise<void> {
    try {
      await this.sesClient.send(
        new SendEmailCommand({
          Source: config.ses.fromEmail,
          Destination: {
            ToAddresses: [recipientEmail],
          },
          Message: {
            Subject: {
              Data: "Admin password reset OTP",
            },
            Body: {
              Text: {
                Data: `Your admin password reset OTP is ${otp}. It expires in ${config.auth.adminForgotPasswordOtpExpiryMinutes} minutes.`,
              },
            },
          },
        }),
      );
    } catch (error) {
      logger.error("Failed to send admin forgot password OTP email", {
        context: this.context,
        recipientEmail,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
