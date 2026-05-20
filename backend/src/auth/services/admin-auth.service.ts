import {
  BadRequestException,
  ConflictException,
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
import { JwtAccessPayload } from "../interfaces/jwt-access-payload.interface";
import { JwtRefreshPayload } from "../interfaces/jwt-refresh-payload.interface";
import { AuthenticatedUser } from "../interfaces/authenticated-request.interface";
import { AuthRepository } from "../repositories/auth.repository";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";

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
    requestId: string,
  ): Promise<AdminSignupResponseDto> {
    this.logger.info("Admin signup attempt", this.context, requestId, {
      email: dto.email,
      role: AdminRole.SUPER_ADMIN,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingAdmin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      requestId,
    );

    if (existingAdmin) {
      this.logger.warn(
        "Duplicate admin email on signup",
        this.context,
        requestId,
        {
          email: normalizedEmail,
        },
      );
      throw new ConflictException("Admin already exists");
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
        requestId,
      );

    this.logger.info("Admin signup success", this.context, requestId, {
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
    requestId: string,
  ): Promise<
    | AdminSigninResponseDto
    | AdminSigninTwoFactorChallengeResponseDto
    | AdminSigninPasswordResetChallengeResponseDto
  > {
    this.logger.info("Admin signin attempt", this.context, requestId, {
      email: dto.email,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      requestId,
    );

    if (!admin || !admin.isActive) {
      this.logger.warn(
        "Admin signin invalid credentials",
        this.context,
        requestId,
        {
          email: normalizedEmail,
        },
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(
        "Admin signin invalid credentials",
        this.context,
        requestId,
        {
          email: normalizedEmail,
        },
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    if (admin.twoFactorEnabled) {
      if (!admin.twoFactorSecretEncrypted) {
        this.logger.error(
          "Admin has 2FA enabled but secret is missing",
          this.context,
          requestId,
          { adminId: admin.id },
        );
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

      this.logger.info(
        "Admin signin requires 2FA verification",
        this.context,
        requestId,
        {
          adminId: admin.id,
        },
      );

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

    return this.issueSessionTokens(admin, requestId);
  }

  async verifyAdminSigninTwoFactor(
    dto: AdminSigninTwoFactorVerifyRequestDto,
    requestId: string,
  ): Promise<
    AdminSigninResponseDto | AdminSigninPasswordResetChallengeResponseDto
  > {
    this.logger.info(
      "Admin 2FA signin verification attempt",
      this.context,
      requestId,
    );

    const payload = await this.verifyAdminTwoFactorChallengeToken(
      dto.twoFactorToken,
    );
    const admin = await this.authRepository.findAdminById(
      payload.sub,
      requestId,
    );

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

    return this.issueSessionTokens(admin, requestId);
  }

  async adminInitialPasswordReset(
    dto: AdminInitialPasswordResetRequestDto,
    requestId: string,
  ): Promise<void> {
    const payload = await this.verifyAdminInitialPasswordResetToken(
      dto.resetPasswordToken,
    );

    const admin = await this.authRepository.findAdminById(
      payload.sub,
      requestId,
    );
    if (!admin || !admin.isActive || !admin.requirePasswordReset) {
      throw new UnauthorizedException(
        "Invalid or expired initial password reset token",
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.authRepository.updateAdminPasswordHash(
      admin.id,
      newPasswordHash,
      requestId,
    );
    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      requestId,
    );
  }

  async setupAdminTwoFactor(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AdminTwoFactorSetupResponseDto> {
    const admin = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      requestId,
    );

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Admin not found");
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
      requestId,
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
    requestId: string,
  ): Promise<AdminTwoFactorEnableResponseDto> {
    const admin = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      requestId,
    );

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Admin not found");
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
      requestId,
    );

    return { recoveryCodes };
  }

  async disableAdminTwoFactor(
    authenticatedUser: AuthenticatedUser,
    dto: AdminTwoFactorDisableRequestDto,
    requestId: string,
  ): Promise<void> {
    const admin = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      requestId,
    );

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Admin not found");
    }

    if (!admin.twoFactorEnabled || !admin.twoFactorSecretEncrypted) {
      throw new BadRequestException("2FA is not enabled");
    }

    const secret = this.decryptTwoFactorSecret(admin.twoFactorSecretEncrypted);
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);
    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    await this.authRepository.disableAdminTwoFactor(admin.id, requestId);
  }

  async recoverAdminTwoFactor(
    dto: AdminTwoFactorRecoverRequestDto,
    requestId: string,
  ): Promise<void> {
    this.logger.info("Admin 2FA recovery attempt", this.context, requestId, {
      email: dto.email,
    });

    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      requestId,
    );

    if (
      !admin ||
      !admin.isActive ||
      !admin.twoFactorEnabled ||
      !admin.twoFactorRecoveryCodeHashes ||
      admin.twoFactorRecoveryCodeHashes.length === 0
    ) {
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    const matchedIndex = await this.findMatchingRecoveryCodeIndex(
      dto.recoveryCode.trim().toUpperCase(),
      admin.twoFactorRecoveryCodeHashes,
    );

    if (matchedIndex === -1) {
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    await this.authRepository.disableAdminTwoFactor(admin.id, requestId);
    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      requestId,
    );

    this.logger.warn(
      "Admin 2FA recovered and disabled",
      this.context,
      requestId,
      {
        adminId: admin.id,
        usedRecoveryCodeIndex: matchedIndex,
      },
    );
  }

  async inviteAirlineAdmin(
    authenticatedUser: AuthenticatedUser,
    dto: AdminInviteAirlineAdminRequestDto,
    requestId: string,
  ): Promise<AdminInviteAirlineAdminResponseDto> {
    const inviter = await this.authRepository.findAdminById(
      authenticatedUser.sub,
      requestId,
    );
    if (!inviter || !inviter.isActive) {
      throw new UnauthorizedException("Admin not found");
    }

    const normalizedAirlineCode = dto.airlineCode.trim().toUpperCase();
    const normalizedAdminEmail = dto.adminEmail.toLowerCase().trim();
    const normalizedContactEmail =
      dto.contactEmail?.toLowerCase().trim() ?? null;

    const existingAirline = await this.authRepository.findAirlineByCode(
      normalizedAirlineCode,
      requestId,
    );
    if (existingAirline) {
      throw new ConflictException("Airline code already exists");
    }

    const existingAirlineUser =
      await this.authRepository.findAirlineUserByEmail(
        normalizedAdminEmail,
        requestId,
      );
    if (existingAirlineUser) {
      throw new ConflictException("Airline admin email already exists");
    }

    const activeInviteByEmail =
      await this.authRepository.findActiveAirlineAdminInviteByEmail(
        normalizedAdminEmail,
        requestId,
      );
    if (activeInviteByEmail) {
      throw new ConflictException(
        "Active invitation already exists for this email",
      );
    }

    const airline = await this.authRepository.createAirline(
      {
        name: dto.airlineName.trim(),
        code: normalizedAirlineCode,
        countryCode: dto.countryCode,
        companyRegistrationNumber: dto.companyRegistrationNumber.trim(),
        website: dto.website?.trim() ?? null,
        contactEmail: dto.contactEmail.trim(),
        contactPhone: dto.contactPhone.trim(),
        timezone: dto.timezone.trim(),
        currency: dto.currency.trim().toUpperCase(),
        address: dto.address.trim(),
        logo: dto.logo?.trim() ?? null,
        isActive: true,
      },
      requestId,
    );

    const invitationToken = crypto.randomBytes(32).toString("hex");
    const tokenLookup = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");
    const tokenHash = await bcrypt.hash(invitationToken, 10);
    const expiresAt = new Date(
      Date.now() + this.durationToMs(config.auth.airlineAdminInviteExpiresIn),
    );

    const invite = await this.authRepository.createAirlineAdminInvite(
      {
        airlineId: airline.id,
        invitedByAdminId: inviter.id,
        firstName: dto.adminFirstName.trim(),
        lastName: dto.adminLastName.trim(),
        email: normalizedAdminEmail,
        jobTitle: dto.jobTitle.trim(),
        tokenLookup,
        tokenHash,
        expiresAt,
        isAccepted: false,
      },
      requestId,
    );

    const onboardingLink = `${config.auth.airlineAdminOnboardingBaseUrl}?token=${invitationToken}`;

    if (this.isOtpRestrictedEnvironment()) {
      this.logger.info(
        "Airline admin invitation generated in non-production mode",
        this.context,
        requestId,
        {
          inviteId: invite.id,
          airlineId: airline.id,
          email: normalizedAdminEmail,
          onboardingLink,
        },
      );
    } else {
      await this.sendAirlineAdminInviteEmail(
        normalizedAdminEmail,
        onboardingLink,
        dto.airlineName,
        requestId,
      );
    }

    return {
      invitationId: invite.id,
      airlineId: airline.id,
      airlineName: airline.name,
      airlineCode: airline.code,
      companyRegistrationNumber: airline.companyRegistrationNumber,
      website: airline.website || undefined,
      contactEmail: normalizedContactEmail,
      contactPhone: airline.contactPhone,
      timezone: airline.timezone,
      currency: airline.currency,
      address: airline.address,
      logo: airline.logo || undefined,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      jobTitle: invite.jobTitle,
      expiresIn: config.auth.airlineAdminInviteExpiresIn,
      onboardingLink: this.isOtpRestrictedEnvironment() ? onboardingLink : null,
    };
  }

  private async issueSessionTokens(
    admin: AdminEntity,
    requestId: string,
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
      requestId,
    );
    await this.authRepository.saveRefreshToken(
      admin.id,
      refreshTokenHash,
      refreshTokenExpiresAt,
      requestId,
    );
    await this.authRepository.updateLastLogin(admin.id, new Date(), requestId);

    this.logger.info("Admin signin success", this.context, requestId, {
      adminId: admin.id,
      email: admin.email,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.jwt.accessExpiresIn,
      refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
      admin: this.toAdminProfile(admin),
    };
  }

  async refreshToken(
    dto: RefreshTokenRequestDto,
    requestId: string,
  ): Promise<AdminSigninResponseDto> {
    this.logger.info("Refresh token attempt", this.context, requestId);

    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const adminId = payload.sub;

    const admin = await this.authRepository.findAdminById(adminId, requestId);
    if (!admin || !admin.isActive) {
      this.logger.warn("Invalid refresh token", this.context, requestId, {
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const existingToken =
      await this.authRepository.findActiveRefreshTokenByAdminId(
        adminId,
        requestId,
      );

    if (!existingToken) {
      this.logger.warn("Invalid refresh token", this.context, requestId, {
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(
      dto.refreshToken,
      existingToken.tokenHash,
    );
    if (!isMatch) {
      this.logger.warn("Invalid refresh token", this.context, requestId, {
        adminId,
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.authRepository.revokeRefreshToken(existingToken.id, requestId);

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
      requestId,
    );

    this.logger.info("Refresh token success", this.context, requestId, {
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
    requestId: string,
  ): Promise<void> {
    const adminId = authenticatedUser.sub;
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (payload.sub !== adminId) {
      this.logger.warn(
        "Invalid refresh token on signout",
        this.context,
        requestId,
        {
          adminId,
        },
      );
      throw new UnauthorizedException("Invalid refresh token");
    }

    const existingToken =
      await this.authRepository.findActiveRefreshTokenByAdminId(
        adminId,
        requestId,
      );

    if (!existingToken) {
      this.logger.warn(
        "Invalid refresh token on signout",
        this.context,
        requestId,
        {
          adminId,
        },
      );
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(
      dto.refreshToken,
      existingToken.tokenHash,
    );
    if (!isMatch) {
      this.logger.warn(
        "Invalid refresh token on signout",
        this.context,
        requestId,
        {
          adminId,
        },
      );
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.authRepository.revokeRefreshToken(existingToken.id, requestId);

    this.logger.info("Admin signout success", this.context, requestId, {
      adminId,
    });
  }

  async adminForgotPasswordSendOtp(
    dto: AdminForgotPasswordSendOtpRequestDto,
    requestId: string,
  ): Promise<void> {
    this.logger.info(
      "Admin forgot password send OTP attempt",
      this.context,
      requestId,
      {
        email: dto.email,
      },
    );

    const normalizedEmail = dto.email.toLowerCase().trim();
    const admin = await this.authRepository.findAdminByEmail(
      normalizedEmail,
      requestId,
    );

    if (!admin || !admin.isActive) {
      this.logger.info(
        "Admin forgot password send OTP accepted with no active admin match",
        this.context,
        requestId,
        { email: normalizedEmail },
      );
      return;
    }

    const recentOtpCount =
      await this.authRepository.countRecentAdminForgotPasswordOtps(
        admin.id,
        new Date(
          Date.now() -
            config.auth.adminForgotPasswordOtpSendWindowMinutes * 60 * 1000,
        ),
        requestId,
      );

    if (recentOtpCount >= config.auth.adminForgotPasswordOtpSendLimit) {
      this.logger.warn(
        "Admin forgot password OTP send limit reached",
        this.context,
        requestId,
        {
          adminId: admin.id,
          sendLimit: config.auth.adminForgotPasswordOtpSendLimit,
        },
      );
      return;
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
      requestId,
    );
    await this.authRepository.saveAdminForgotPasswordOtp(
      admin.id,
      otpHash,
      expiresAt,
      requestId,
    );

    if (this.isOtpRestrictedEnvironment()) {
      this.logger.info(
        "Admin forgot password OTP generated in non-production mode",
        this.context,
        requestId,
        {
          adminId: admin.id,
          otp,
        },
      );
      return;
    }

    await this.sendAdminForgotPasswordOtpEmail(admin.email, otp, requestId);

    this.logger.info(
      "Admin forgot password OTP email sent",
      this.context,
      requestId,
      {
        adminId: admin.id,
        email: admin.email,
      },
    );
  }

  async adminForgotPasswordVerifyOtp(
    dto: AdminForgotPasswordVerifyOtpRequestDto,
    requestId: string,
  ): Promise<AdminForgotPasswordVerifyOtpResponseDto> {
    this.logger.info(
      "Admin forgot password verify OTP attempt",
      this.context,
      requestId,
      {
        email: dto.email,
      },
    );

    const admin = await this.authRepository.findAdminByEmail(
      dto.email.toLowerCase().trim(),
      requestId,
    );

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    const activeOtp =
      await this.authRepository.findActiveAdminForgotPasswordOtpByAdminId(
        admin.id,
        requestId,
      );

    if (!activeOtp) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    if (
      activeOtp.attemptCount >= config.auth.adminForgotPasswordOtpMaxAttempts
    ) {
      await this.authRepository.markAdminForgotPasswordOtpUsed(
        activeOtp.id,
        requestId,
      );
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    const isOtpValid = await bcrypt.compare(dto.otp, activeOtp.otpHash);
    if (!isOtpValid) {
      await this.authRepository.incrementAdminForgotPasswordOtpAttempts(
        activeOtp.id,
        activeOtp.attemptCount,
        requestId,
      );
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    await this.authRepository.markAdminForgotPasswordOtpVerified(
      activeOtp.id,
      requestId,
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
    requestId: string,
  ): Promise<void> {
    this.logger.info(
      "Admin forgot password reset attempt",
      this.context,
      requestId,
      {},
    );

    const payload = await this.verifyAdminForgotPasswordResetToken(
      dto.resetPasswordToken,
    );
    const admin = await this.authRepository.findAdminById(
      payload.sub,
      requestId,
    );
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException(
        "Invalid or expired reset password token",
      );
    }

    const otpRecord = await this.authRepository.findAdminForgotPasswordOtpById(
      payload.otpId,
      requestId,
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
      requestId,
    );
    await this.authRepository.revokeActiveRefreshTokensByAdminId(
      admin.id,
      requestId,
    );
    await this.authRepository.markAdminForgotPasswordOtpUsed(
      otpRecord.id,
      requestId,
    );

    this.logger.info(
      "Admin forgot password reset success",
      this.context,
      requestId,
      {
        adminId: admin.id,
      },
    );
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

  private toAdminProfile(admin: AdminEntity): AdminSigninResponseDto["admin"] {
    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      accessControls: [],
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

  private async sendAirlineAdminInviteEmail(
    recipientEmail: string,
    onboardingLink: string,
    airlineName: string,
    requestId: string,
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
              Data: "Airline admin invitation",
            },
            Body: {
              Text: {
                Data: `You have been invited as airline admin for ${airlineName}. Complete onboarding using this link: ${onboardingLink}`,
              },
            },
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        "Failed to send airline admin invite email",
        this.context,
        requestId,
        {
          recipientEmail,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
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
    requestId: string,
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
      this.logger.error(
        "Failed to send admin forgot password OTP email",
        this.context,
        requestId,
        {
          recipientEmail,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }
}
