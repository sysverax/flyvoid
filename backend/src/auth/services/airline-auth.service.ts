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
import { AirlineUserEntity } from "../../airline/entities/airline-user.entity";
import { AirlineInvitationRepository } from "../../airline/repositories/airline-invitation.repository";
import { AirlineRole, UserType } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { config } from "../../config/config";
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
import { JwtAccessPayload } from "../interfaces/jwt-access-payload.interface";
import { JwtRefreshPayload } from "../interfaces/jwt-refresh-payload.interface";
import { AuthenticatedUser } from "../interfaces/authenticated-request.interface";
import { AuthRepository } from "../repositories/auth.repository";

@Injectable()
export class AirlineAuthService {
  private readonly context = "AirlineAuthService";
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
    private readonly airlineInvitationRepository: AirlineInvitationRepository,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async onboardAirlineAdmin(
    dto: AirlineAdminOnboardRequestDto,
    requestId: string,
  ): Promise<AirlineAdminOnboardResponseDto> {
    this.logger.info(
      "Airline admin onboarding attempt",
      this.context,
      requestId,
    );

    const invite = await this.findPendingAirlineInviteByToken(
      dto.invitationToken,
      requestId,
    );
    if (!invite) {
      throw new UnauthorizedException("Invalid or expired invitation token");
    }

    const adminCount =
      await this.airlineInvitationRepository.countAirlineAdminsByAirlineId(
        invite.airlineId,
        requestId,
      );
    if (adminCount > 0) {
      throw new ConflictException("Airline admin already onboarded");
    }

    const existingAirlineUser =
      await this.authRepository.findAirlineUserByEmail(invite.email, requestId);
    if (existingAirlineUser) {
      throw new ConflictException("Airline admin email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.authRepository.createAirlineUser(
      {
        airlineId: invite.airlineId,
        firstName: invite.firstName,
        lastName: invite.lastName,
        email: invite.email,
        jobTitle: invite.jobTitle,
        passwordHash,
        role: AirlineRole.AIRLINE_ADMIN,
        isActive: true,
      },
      requestId,
    );

    await this.airlineInvitationRepository.markAirlineAdminInviteAccepted(
      invite.id,
      requestId,
    );

    return {
      userId: user.id,
      airlineId: user.airlineId,
      email: user.email,
    };
  }

  async signin(
    dto: AirlineSigninRequestDto,
    requestId: string,
  ): Promise<
    AirlineSigninResponseDto | AirlineSigninTwoFactorChallengeResponseDto
  > {
    this.logger.info("Airline signin attempt", this.context, requestId, {
      email: dto.email,
    });

    const user = await this.authRepository.findAirlineUserByEmail(
      dto.email.toLowerCase().trim(),
      requestId,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecretEncrypted) {
        throw new UnauthorizedException("2FA setup is invalid");
      }

      const twoFactorToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          userType: UserType.AIRLINE,
          type: "airline_2fa_challenge",
        },
        {
          secret: config.jwt.accessSecret,
          expiresIn: this.getJwtDuration(
            config.auth.twoFactorChallengeTokenExpiresIn,
          ),
        },
      );

      return {
        requiresTwoFactor: true,
        twoFactorToken,
        twoFactorTokenExpiresIn: config.auth.twoFactorChallengeTokenExpiresIn,
        user: this.toAirlineUserProfile(user),
      };
    }

    return this.issueSessionTokens(user, requestId);
  }

  async verifySigninTwoFactor(
    dto: AirlineSigninTwoFactorVerifyRequestDto,
    requestId: string,
  ): Promise<AirlineSigninResponseDto> {
    const payload = await this.verifyAirlineTwoFactorChallengeToken(
      dto.twoFactorToken,
    );

    const user = await this.authRepository.findAirlineUserById(
      payload.sub,
      requestId,
    );
    if (
      !user ||
      !user.isActive ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecretEncrypted
    ) {
      throw new UnauthorizedException("Invalid 2FA verification request");
    }

    const secret = this.decryptTwoFactorSecret(user.twoFactorSecretEncrypted);
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);
    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    return this.issueSessionTokens(user, requestId);
  }

  async setupTwoFactor(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AirlineTwoFactorSetupResponseDto> {
    const user = await this.requireAirlineUser(authenticatedUser, requestId);

    if (user.twoFactorEnabled) {
      throw new BadRequestException("2FA is already enabled");
    }

    const generatedSecret = speakeasy.generateSecret({
      name: `${config.auth.twoFactorIssuer}:${user.email}`,
      issuer: config.auth.twoFactorIssuer,
      length: 20,
    });

    if (!generatedSecret.base32 || !generatedSecret.otpauth_url) {
      throw new BadRequestException("Unable to generate 2FA setup secret");
    }

    await this.authRepository.saveAirlineTwoFactorTempSecret(
      user.id,
      this.encryptTwoFactorSecret(generatedSecret.base32),
      requestId,
    );

    const qrCodeDataUrl = await QRCode.toDataURL(generatedSecret.otpauth_url);

    return {
      manualEntryKey: generatedSecret.base32,
      qrCodeDataUrl,
    };
  }

  async enableTwoFactor(
    authenticatedUser: AuthenticatedUser,
    dto: AirlineTwoFactorEnableRequestDto,
    requestId: string,
  ): Promise<AirlineTwoFactorEnableResponseDto> {
    const user = await this.requireAirlineUser(authenticatedUser, requestId);

    if (user.twoFactorEnabled) {
      throw new BadRequestException("2FA is already enabled");
    }

    if (!user.twoFactorTempSecretEncrypted) {
      throw new BadRequestException("2FA setup has not been initialized");
    }

    const secret = this.decryptTwoFactorSecret(
      user.twoFactorTempSecretEncrypted,
    );
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);
    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    const recoveryCodes = this.generateTwoFactorRecoveryCodes();
    const recoveryCodeHashes = await Promise.all(
      recoveryCodes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.authRepository.enableAirlineTwoFactor(
      user.id,
      this.encryptTwoFactorSecret(secret),
      recoveryCodeHashes,
      requestId,
    );

    return { recoveryCodes };
  }

  async disableTwoFactor(
    authenticatedUser: AuthenticatedUser,
    dto: AirlineTwoFactorDisableRequestDto,
    requestId: string,
  ): Promise<void> {
    const user = await this.requireAirlineUser(authenticatedUser, requestId);

    if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
      throw new BadRequestException("2FA is not enabled");
    }

    const secret = this.decryptTwoFactorSecret(user.twoFactorSecretEncrypted);
    const isCodeValid = this.verifyTwoFactorCode(secret, dto.twoFactorCode);
    if (!isCodeValid) {
      throw new UnauthorizedException("Invalid 2FA code");
    }

    await this.authRepository.disableAirlineTwoFactor(user.id, requestId);
  }

  async recoverTwoFactor(
    dto: AirlineTwoFactorRecoverRequestDto,
    requestId: string,
  ): Promise<void> {
    const user = await this.authRepository.findAirlineUserByEmail(
      dto.email.toLowerCase().trim(),
      requestId,
    );

    if (
      !user ||
      !user.isActive ||
      !user.twoFactorEnabled ||
      !user.twoFactorRecoveryCodeHashes ||
      user.twoFactorRecoveryCodeHashes.length === 0
    ) {
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    const matchedIndex = await this.findMatchingRecoveryCodeIndex(
      dto.recoveryCode,
      user.twoFactorRecoveryCodeHashes,
    );

    if (matchedIndex === -1) {
      throw new UnauthorizedException("Invalid recovery credentials");
    }

    await this.authRepository.disableAirlineTwoFactor(user.id, requestId);
    await this.authRepository.revokeActiveAirlineRefreshTokensByAirlineUserId(
      user.id,
      requestId,
    );
  }

  async forgotPasswordSendOtp(
    dto: AirlineForgotPasswordSendOtpRequestDto,
    requestId: string,
  ): Promise<void> {
    const user = await this.authRepository.findAirlineUserByEmail(
      dto.email,
      requestId,
    );

    if (!user || !user.isActive) {
      return;
    }

    const recentOtpCount =
      await this.authRepository.countRecentAirlineForgotPasswordOtps(
        user.id,
        new Date(
          Date.now() -
            config.auth.adminForgotPasswordOtpSendWindowMinutes * 60 * 1000,
        ),
        requestId,
      );

    if (recentOtpCount >= config.auth.adminForgotPasswordOtpSendLimit) {
      return;
    }

    const otp = this.isOtpRestrictedEnvironment()
      ? config.auth.adminForgotPasswordOtpStatic
      : this.generateSixDigitOtp();

    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(
      Date.now() + config.auth.adminForgotPasswordOtpExpiryMinutes * 60 * 1000,
    );

    await this.authRepository.invalidateActiveAirlineForgotPasswordOtpsByAirlineUserId(
      user.id,
      requestId,
    );
    await this.authRepository.saveAirlineForgotPasswordOtp(
      user.id,
      otpHash,
      expiresAt,
      requestId,
    );

    if (this.isOtpRestrictedEnvironment()) {
      this.logger.info(
        "Airline forgot password OTP generated in non-production mode",
        this.context,
        requestId,
        {
          airlineUserId: user.id,
          otp,
        },
      );
      return;
    }

    await this.sendAirlineForgotPasswordOtpEmail(user.email, otp, requestId);
  }

  async forgotPasswordVerifyOtp(
    dto: AirlineForgotPasswordVerifyOtpRequestDto,
    requestId: string,
  ): Promise<AirlineForgotPasswordVerifyOtpResponseDto> {
    const user = await this.authRepository.findAirlineUserByEmail(
      dto.email,
      requestId,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    const activeOtp =
      await this.authRepository.findActiveAirlineForgotPasswordOtpByAirlineUserId(
        user.id,
        requestId,
      );

    if (!activeOtp) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    if (
      activeOtp.attemptCount >= config.auth.adminForgotPasswordOtpMaxAttempts
    ) {
      await this.authRepository.markAirlineForgotPasswordOtpUsed(
        activeOtp.id,
        requestId,
      );
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    const isOtpValid = await bcrypt.compare(dto.otp, activeOtp.otpHash);
    if (!isOtpValid) {
      await this.authRepository.incrementAirlineForgotPasswordOtpAttempts(
        activeOtp.id,
        activeOtp.attemptCount,
        requestId,
      );
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    await this.authRepository.markAirlineForgotPasswordOtpVerified(
      activeOtp.id,
      requestId,
    );

    const resetPasswordToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        otpId: activeOtp.id,
        userType: UserType.AIRLINE,
        type: "airline_forgot_password_reset",
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

  async forgotPasswordReset(
    dto: AirlineForgotPasswordResetRequestDto,
    requestId: string,
  ): Promise<void> {
    const payload = await this.verifyAirlineForgotPasswordResetToken(
      dto.resetPasswordToken,
    );

    const user = await this.authRepository.findAirlineUserById(
      payload.sub,
      requestId,
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        "Invalid or expired reset password token",
      );
    }

    const otpRecord =
      await this.authRepository.findAirlineForgotPasswordOtpById(
        payload.otpId,
        requestId,
      );

    if (
      !otpRecord ||
      otpRecord.airlineUserId !== user.id ||
      otpRecord.isUsed ||
      !otpRecord.isVerified ||
      otpRecord.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        "Invalid or expired reset password token",
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.authRepository.updateAirlineUserPasswordHash(
      user.id,
      newPasswordHash,
      requestId,
    );
    await this.authRepository.revokeActiveAirlineRefreshTokensByAirlineUserId(
      user.id,
      requestId,
    );
    await this.authRepository.markAirlineForgotPasswordOtpUsed(
      otpRecord.id,
      requestId,
    );
  }

  async refresh(
    dto: RefreshTokenRequestDto,
    requestId: string,
  ): Promise<AirlineSigninResponseDto> {
    const payload = await this.verifyAirlineRefreshToken(dto.refreshToken);
    const user = await this.authRepository.findAirlineUserById(
      payload.sub,
      requestId,
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const existingToken =
      await this.authRepository.findActiveAirlineRefreshTokenByAirlineUserId(
        user.id,
        requestId,
      );

    if (!existingToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(
      dto.refreshToken,
      existingToken.tokenHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.authRepository.revokeAirlineRefreshToken(
      existingToken.id,
      requestId,
    );

    return this.issueSessionTokens(user, requestId);
  }

  async signout(
    authenticatedUser: AuthenticatedUser,
    dto: SignoutRequestDto,
    requestId: string,
  ): Promise<void> {
    const user = await this.requireAirlineUser(authenticatedUser, requestId);

    const payload = await this.verifyAirlineRefreshToken(dto.refreshToken);
    if (payload.sub !== user.id) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const existingToken =
      await this.authRepository.findActiveAirlineRefreshTokenByAirlineUserId(
        user.id,
        requestId,
      );

    if (!existingToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isMatch = await bcrypt.compare(
      dto.refreshToken,
      existingToken.tokenHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.authRepository.revokeAirlineRefreshToken(
      existingToken.id,
      requestId,
    );
  }

  private async issueSessionTokens(
    user: AirlineUserEntity,
    requestId: string,
  ): Promise<AirlineSigninResponseDto> {
    const accessTokenPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      userType: UserType.AIRLINE,
      airlineId: user.airlineId,
      type: "access",
    };

    const refreshTokenPayload: JwtRefreshPayload = {
      sub: user.id,
      type: "refresh",
      userType: UserType.AIRLINE,
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

    await this.authRepository.revokeActiveAirlineRefreshTokensByAirlineUserId(
      user.id,
      requestId,
    );
    await this.authRepository.saveAirlineRefreshToken(
      user.id,
      refreshTokenHash,
      refreshTokenExpiresAt,
      requestId,
    );
    await this.authRepository.updateAirlineUserLastLogin(
      user.id,
      new Date(),
      requestId,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.jwt.accessExpiresIn,
      refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
      user: this.toAirlineUserProfile(user),
    };
  }

  private async requireAirlineUser(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AirlineUserEntity> {
    if (authenticatedUser.userType !== UserType.AIRLINE) {
      throw new UnauthorizedException("Unauthorized");
    }

    const user = await this.authRepository.findAirlineUserById(
      authenticatedUser.sub,
      requestId,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Airline user not found");
    }

    return user;
  }

  private async verifyAirlineRefreshToken(
    token: string,
  ): Promise<JwtRefreshPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        token,
        {
          secret: config.jwt.refreshSecret,
        },
      );

      if (payload.type !== "refresh" || payload.userType !== UserType.AIRLINE) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async verifyAirlineTwoFactorChallengeToken(
    token: string,
  ): Promise<{ sub: number; type: string; userType: UserType }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        type: string;
        userType: UserType;
      }>(token, {
        secret: config.jwt.accessSecret,
      });

      if (
        payload.type !== "airline_2fa_challenge" ||
        payload.userType !== UserType.AIRLINE
      ) {
        throw new UnauthorizedException("Invalid 2FA verification request");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("Invalid 2FA verification request");
    }
  }

  private async verifyAirlineForgotPasswordResetToken(
    token: string,
  ): Promise<{ sub: number; otpId: number; type: string; userType: UserType }> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        otpId: number;
        type: string;
        userType: UserType;
      }>(token, {
        secret: config.jwt.accessSecret,
      });

      if (
        payload.type !== "airline_forgot_password_reset" ||
        payload.userType !== UserType.AIRLINE
      ) {
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
      const isMatch = await bcrypt.compare(
        recoveryCode.trim().toUpperCase(),
        hashes[index],
      );
      if (isMatch) {
        return index;
      }
    }

    return -1;
  }

  private async findPendingAirlineInviteByToken(
    invitationToken: string,
    requestId: string,
  ) {
    const token = invitationToken.trim();
    if (!token) {
      return null;
    }

    const tokenLookup = crypto.createHash("sha256").update(token).digest("hex");
    const invite =
      await this.airlineInvitationRepository.findPendingAirlineAdminInviteByLookup(
        tokenLookup,
        requestId,
      );
    if (!invite) {
      return null;
    }

    if (invite.expiresAt.getTime() <= Date.now() || invite.isRevoked) {
      throw new UnauthorizedException("Invalid or expired invitation token");
    }

    if (invite.isAccepted) {
      throw new ConflictException("Airline admin already onboarded");
    }

    const isTokenValid = await bcrypt.compare(token, invite.tokenHash);
    return isTokenValid ? invite : null;
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

  private async sendAirlineForgotPasswordOtpEmail(
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
              Data: "Airline password reset OTP",
            },
            Body: {
              Text: {
                Data: `Your airline password reset OTP is ${otp}. It expires in ${config.auth.adminForgotPasswordOtpExpiryMinutes} minutes.`,
              },
            },
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        "Failed to send airline forgot password OTP email",
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

  private toAirlineUserProfile(user: AirlineUserEntity) {
    return {
      id: user.id,
      airlineId: user.airlineId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role as AirlineRole,
    };
  }
}
