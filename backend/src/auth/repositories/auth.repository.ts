import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import { AdminEntity } from "../../admin/entities/admin.entity";
import { PlatformAccessControlEntity } from "../../admin/entities/platform-access-control.entity";
import { AirlineAccessControlEntity } from "../../airline/entities/airline-access-control.entity";
import { AirlineEntity } from "../../airline/entities/airline.entity";
import { AirlineUserEntity } from "../../airline/entities/airline-user.entity";
import {
  AccessAction,
  PlatformAsset,
  UserAccessControlEntry,
} from "../../common/constants/access-control.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlinePasswordResetOtpEntity } from "../entities/airline-password-reset-otp.entity";
import { AirlineRefreshTokenEntity } from "../entities/airline-refresh-token.entity";
import { AdminPasswordResetOtpEntity } from "../entities/admin-password-reset-otp.entity";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";
import { Logger } from "winston";

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(AdminPasswordResetOtpEntity)
    private readonly adminPasswordResetOtpRepository: Repository<AdminPasswordResetOtpEntity>,
    @InjectRepository(AirlineRefreshTokenEntity)
    private readonly airlineRefreshTokenRepository: Repository<AirlineRefreshTokenEntity>,
    @InjectRepository(AirlinePasswordResetOtpEntity)
    private readonly airlinePasswordResetOtpRepository: Repository<AirlinePasswordResetOtpEntity>,
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    @InjectRepository(AirlineUserEntity)
    private readonly airlineUserRepository: Repository<AirlineUserEntity>,
    @InjectRepository(PlatformAccessControlEntity)
    private readonly platformAccessControlRepository: Repository<PlatformAccessControlEntity>,
    @InjectRepository(AirlineAccessControlEntity)
    private readonly airlineAccessControlRepository: Repository<AirlineAccessControlEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findPlatformAccessControlsByAdminId(
    adminId: number,
    logger: Logger,
  ): Promise<UserAccessControlEntry[]> {
    this.logger.debug(
      `Finding platform access controls by admin id: ${adminId}`,
      "AuthRepository",
    );

    const rows = await this.platformAccessControlRepository.find({
      where: { adminId },
    });

    return this.groupAccessControlRows(
      rows.map((row) => ({
        asset: row.asset,
        action: row.accessAction,
      })),
    );
  }

  async findAirlineAccessControlsByAirlineUserId(
    airlineUserId: number,
    requestId: string,
  ): Promise<UserAccessControlEntry[]> {
    this.logger.debug(
      "Finding airline access controls by airline user id",
      "AuthRepository",
      requestId,
      { airlineUserId },
    );

    const rows = await this.airlineAccessControlRepository.find({
      where: { airlineUserId },
    });

    return this.groupAccessControlRows(
      rows.map((row) => ({
        asset: row.asset,
        action: row.accessAction,
      })),
    );
  }

  private groupAccessControlRows(
    rows: Array<{ asset: string; action: AccessAction }>,
  ): UserAccessControlEntry[] {
    const grouped = new Map<string, Set<AccessAction>>();

    for (const row of rows) {
      const existing = grouped.get(row.asset);
      if (existing) {
        existing.add(row.action);
      } else {
        grouped.set(row.asset, new Set([row.action]));
      }
    }

    return Array.from(grouped.entries()).map(([moduleKey, actions]) => ({
      moduleKey,
      permissions: Array.from(actions),
    }));
  }

  async findAdminByEmail(
    email: string,
    logger: Logger,
  ): Promise<AdminEntity | null> {
    this.logger.debug(`Finding admin by email: ${email}`, "AuthRepository");

    return this.adminRepository.findOne({ where: { email } });
  }

  async findAdminById(id: number, logger: Logger): Promise<AdminEntity | null> {
    this.logger.debug(`Finding admin by id: ${id}`, "AuthRepository");

    return this.adminRepository.findOne({ where: { id } });
  }

  async createAdmin(
    payload: Pick<
      AdminEntity,
      | "firstName"
      | "lastName"
      | "email"
      | "passwordHash"
      | "role"
      | "isActive"
      | "requirePasswordReset"
    >,
    requestId: string,
  ): Promise<AdminEntity> {
    this.logger.debug("Creating admin", "AuthRepository", requestId, {
      email: payload.email,
      role: payload.role,
    });

    const admin = this.adminRepository.create(payload);
    return this.adminRepository.save(admin);
  }

  async createAdminWithPlatformAccessControls(
    payload: Pick<
      AdminEntity,
      | "firstName"
      | "lastName"
      | "email"
      | "passwordHash"
      | "role"
      | "isActive"
      | "requirePasswordReset"
    >,
    controls: Array<{ asset: PlatformAsset; access: AccessAction[] }>,
    logger: Logger,
  ): Promise<AdminEntity> {
    logger.debug("Creating admin with platform access controls", {
      email: payload.email,
      role: payload.role,
      controlCount: controls.length,
    });

    return this.adminRepository.manager.transaction(async (entityManager) => {
      const adminRepository = entityManager.getRepository(AdminEntity);
      const platformAccessControlRepository = entityManager.getRepository(
        PlatformAccessControlEntity,
      );

      const admin = await adminRepository.save(adminRepository.create(payload));
      const flattened = controls.flatMap((control) =>
        control.access.map((accessAction) => ({
          adminId: admin.id,
          asset: control.asset,
          accessAction,
        })),
      );

      if (flattened.length > 0) {
        const deduped = Array.from(
          new Map(
            flattened.map((entry) => [
              `${entry.adminId}:${entry.asset}:${entry.accessAction}`,
              entry,
            ]),
          ).values(),
        );

        await platformAccessControlRepository.save(
          platformAccessControlRepository.create(deduped),
        );
      }

      return admin;
    });
  }

  async saveRefreshToken(
    adminId: number,
    tokenHash: string,
    expiresAt: Date,
    logger: Logger,
  ): Promise<RefreshTokenEntity> {
    logger.debug("Saving refresh token", {
      context: "AuthRepository",
      adminId,
      expiresAt: expiresAt.toISOString(),
    });

    const refreshToken = this.refreshTokenRepository.create({
      adminId,
      tokenHash,
      expiresAt,
      isRevoked: false,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  async findActiveRefreshTokenByAdminId(
    adminId: number,
    logger: Logger,
  ): Promise<RefreshTokenEntity | null> {
    logger.debug("Finding active refresh token by admin id", {
      context: "AuthRepository",
      adminId,
    });

    return this.refreshTokenRepository.findOne({
      where: {
        adminId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async revokeRefreshToken(id: number, logger: Logger): Promise<void> {
    logger.debug("Revoking refresh token", {
      context: "AuthRepository",
      refreshTokenId: id,
    });

    await this.refreshTokenRepository.update({ id }, { isRevoked: true });
  }

  async revokeActiveRefreshTokensByAdminId(
    adminId: number,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Revoking active refresh tokens by admin id", {
      context: "AuthRepository",
      adminId,
    });

    await this.refreshTokenRepository.update(
      { adminId, isRevoked: false },
      { isRevoked: true },
    );
  }

  async updateLastLogin(
    adminId: number,
    lastLoginAt: Date,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Updating admin last login", {
      context: "AuthRepository",
      adminId,
      lastLoginAt: lastLoginAt.toISOString(),
    });

    await this.adminRepository.update({ id: adminId }, { lastLoginAt });
  }

  async countRecentAdminForgotPasswordOtps(
    adminId: number,
    since: Date,
    logger: Logger,
  ): Promise<number> {
    logger.debug("Counting recent admin forgot password OTP requests", {
      context: "AuthRepository",
      adminId,
      since: since.toISOString(),
    });

    return this.adminPasswordResetOtpRepository.count({
      where: {
        adminId,
        createdAt: MoreThan(since),
      },
    });
  }

  async invalidateActiveAdminForgotPasswordOtpsByAdminId(
    adminId: number,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Invalidating active admin forgot password OTPs", {
      context: "AuthRepository",
      adminId,
    });

    await this.adminPasswordResetOtpRepository.update(
      {
        adminId,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      {
        isUsed: true,
      },
    );
  }

  async saveAdminForgotPasswordOtp(
    adminId: number,
    otpHash: string,
    expiresAt: Date,
    logger: Logger,
  ): Promise<AdminPasswordResetOtpEntity> {
    logger.debug("Saving admin forgot password OTP", {
      context: "AuthRepository",
      adminId,
      expiresAt: expiresAt.toISOString(),
    });

    const otpRecord = this.adminPasswordResetOtpRepository.create({
      adminId,
      otpHash,
      expiresAt,
      attemptCount: 0,
      isVerified: false,
      isUsed: false,
    });

    return this.adminPasswordResetOtpRepository.save(otpRecord);
  }

  async findActiveAdminForgotPasswordOtpByAdminId(
    adminId: number,
    logger: Logger,
  ): Promise<AdminPasswordResetOtpEntity | null> {
    logger.debug("Finding active admin forgot password OTP", {
      context: "AuthRepository",
      adminId,
    });

    return this.adminPasswordResetOtpRepository.findOne({
      where: {
        adminId,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findAdminForgotPasswordOtpById(
    otpId: number,
    logger: Logger,
  ): Promise<AdminPasswordResetOtpEntity | null> {
    logger.debug("Finding admin forgot password OTP by id", {
      context: "AuthRepository",
      otpId,
    });

    return this.adminPasswordResetOtpRepository.findOne({
      where: { id: otpId },
    });
  }

  async incrementAdminForgotPasswordOtpAttempts(
    otpId: number,
    currentAttemptCount: number,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Incrementing admin forgot password OTP attempts", {
      context: "AuthRepository",
      otpId,
      nextAttemptCount: currentAttemptCount + 1,
    });

    await this.adminPasswordResetOtpRepository.update(
      { id: otpId },
      {
        attemptCount: currentAttemptCount + 1,
      },
    );
  }

  async markAdminForgotPasswordOtpVerified(
    otpId: number,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Marking admin forgot password OTP verified", {
      context: "AuthRepository",
      otpId,
    });

    await this.adminPasswordResetOtpRepository.update(
      { id: otpId },
      { isVerified: true },
    );
  }

  async markAdminForgotPasswordOtpUsed(
    otpId: number,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Marking admin forgot password OTP used", {
      context: "AuthRepository",
      otpId,
    });

    await this.adminPasswordResetOtpRepository.update(
      { id: otpId },
      { isUsed: true },
    );
  }

  async updateAdminPasswordHash(
    adminId: number,
    passwordHash: string,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Updating admin password hash", {
      context: "AuthRepository",
      adminId,
    });

    await this.adminRepository.update(
      { id: adminId },
      { passwordHash, requirePasswordReset: false },
    );
  }

  async saveAdminTwoFactorTempSecret(
    adminId: number,
    tempSecretEncrypted: string,
    logger: Logger,
  ): Promise<void> {
    logger.debug("Saving admin 2FA temporary secret", {
      context: "AuthRepository",
      adminId,
    });

    await this.adminRepository.update(
      { id: adminId },
      { twoFactorTempSecretEncrypted: tempSecretEncrypted },
    );
  }

  async enableAdminTwoFactor(
    adminId: number,
    secretEncrypted: string,
    recoveryCodeHashes: string[],
    logger: Logger,
  ): Promise<void> {
    logger.debug("Enabling admin 2FA", {
      context: "AuthRepository",
      adminId,
    });

    await this.adminRepository.update(
      { id: adminId },
      {
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: secretEncrypted,
        twoFactorTempSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: recoveryCodeHashes,
      },
    );
  }

  async disableAdminTwoFactor(adminId: number, logger: Logger): Promise<void> {
    logger.debug("Disabling admin 2FA", {
      context: "AuthRepository",
      adminId,
    });

    await this.adminRepository.update(
      { id: adminId },
      {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorTempSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: null,
      },
    );
  }

  async findAirlineUserByEmail(
    email: string,
    requestId: string,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by email",
      "AuthRepository",
      requestId,
      { email },
    );

    return this.airlineUserRepository.findOne({ where: { email } });
  }

  async findAirlineUserById(
    id: number,
    requestId: string,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by id",
      "AuthRepository",
      requestId,
      {
        airlineUserId: id,
      },
    );

    return this.airlineUserRepository.findOne({ where: { id } });
  }

  async findAirlineById(
    id: number,
    requestId: string,
  ): Promise<AirlineEntity | null> {
    this.logger.debug("Finding airline by id", "AuthRepository", requestId, {
      airlineId: id,
    });

    return this.airlineRepository.findOne({ where: { id } });
  }

  async saveAirlineRefreshToken(
    airlineUserId: number,
    tokenHash: string,
    expiresAt: Date,
    requestId: string,
  ): Promise<AirlineRefreshTokenEntity> {
    this.logger.debug(
      "Saving airline refresh token",
      "AuthRepository",
      requestId,
      {
        airlineUserId,
        expiresAt: expiresAt.toISOString(),
      },
    );

    const refreshToken = this.airlineRefreshTokenRepository.create({
      airlineUserId,
      tokenHash,
      expiresAt,
      isRevoked: false,
    });

    return this.airlineRefreshTokenRepository.save(refreshToken);
  }

  async findActiveAirlineRefreshTokenByAirlineUserId(
    airlineUserId: number,
    requestId: string,
  ): Promise<AirlineRefreshTokenEntity | null> {
    this.logger.debug(
      "Finding active airline refresh token by airline user id",
      "AuthRepository",
      requestId,
      { airlineUserId },
    );

    return this.airlineRefreshTokenRepository.findOne({
      where: {
        airlineUserId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async revokeAirlineRefreshToken(
    id: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Revoking airline refresh token",
      "AuthRepository",
      requestId,
      { airlineRefreshTokenId: id },
    );

    await this.airlineRefreshTokenRepository.update(
      { id },
      { isRevoked: true },
    );
  }

  async revokeActiveAirlineRefreshTokensByAirlineUserId(
    airlineUserId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Revoking active airline refresh tokens by airline user id",
      "AuthRepository",
      requestId,
      { airlineUserId },
    );

    await this.airlineRefreshTokenRepository.update(
      { airlineUserId, isRevoked: false },
      { isRevoked: true },
    );
  }

  async updateAirlineUserLastLogin(
    airlineUserId: number,
    lastLoginAt: Date,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Updating airline user last login",
      "AuthRepository",
      requestId,
      {
        airlineUserId,
        lastLoginAt: lastLoginAt.toISOString(),
      },
    );

    await this.airlineUserRepository.update(
      { id: airlineUserId },
      { lastLoginAt },
    );
  }

  async countRecentAirlineForgotPasswordOtps(
    airlineUserId: number,
    since: Date,
    requestId: string,
  ): Promise<number> {
    this.logger.debug(
      "Counting recent airline forgot password OTP requests",
      "AuthRepository",
      requestId,
      {
        airlineUserId,
        since: since.toISOString(),
      },
    );

    return this.airlinePasswordResetOtpRepository.count({
      where: {
        airlineUserId,
        createdAt: MoreThan(since),
      },
    });
  }

  async invalidateActiveAirlineForgotPasswordOtpsByAirlineUserId(
    airlineUserId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Invalidating active airline forgot password OTPs",
      "AuthRepository",
      requestId,
      { airlineUserId },
    );

    await this.airlinePasswordResetOtpRepository.update(
      {
        airlineUserId,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      { isUsed: true },
    );
  }

  async saveAirlineForgotPasswordOtp(
    airlineUserId: number,
    otpHash: string,
    expiresAt: Date,
    requestId: string,
  ): Promise<AirlinePasswordResetOtpEntity> {
    this.logger.debug(
      "Saving airline forgot password OTP",
      "AuthRepository",
      requestId,
      {
        airlineUserId,
        expiresAt: expiresAt.toISOString(),
      },
    );

    const otpRecord = this.airlinePasswordResetOtpRepository.create({
      airlineUserId,
      otpHash,
      expiresAt,
      attemptCount: 0,
      isVerified: false,
      isUsed: false,
    });

    return this.airlinePasswordResetOtpRepository.save(otpRecord);
  }

  async findActiveAirlineForgotPasswordOtpByAirlineUserId(
    airlineUserId: number,
    requestId: string,
  ): Promise<AirlinePasswordResetOtpEntity | null> {
    this.logger.debug(
      "Finding active airline forgot password OTP",
      "AuthRepository",
      requestId,
      { airlineUserId },
    );

    return this.airlinePasswordResetOtpRepository.findOne({
      where: {
        airlineUserId,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findAirlineForgotPasswordOtpById(
    otpId: number,
    requestId: string,
  ): Promise<AirlinePasswordResetOtpEntity | null> {
    this.logger.debug(
      "Finding airline forgot password OTP by id",
      "AuthRepository",
      requestId,
      { otpId },
    );

    return this.airlinePasswordResetOtpRepository.findOne({
      where: { id: otpId },
    });
  }

  async incrementAirlineForgotPasswordOtpAttempts(
    otpId: number,
    currentAttemptCount: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Incrementing airline forgot password OTP attempts",
      "AuthRepository",
      requestId,
      {
        otpId,
        nextAttemptCount: currentAttemptCount + 1,
      },
    );

    await this.airlinePasswordResetOtpRepository.update(
      { id: otpId },
      {
        attemptCount: currentAttemptCount + 1,
      },
    );
  }

  async markAirlineForgotPasswordOtpVerified(
    otpId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Marking airline forgot password OTP verified",
      "AuthRepository",
      requestId,
      { otpId },
    );

    await this.airlinePasswordResetOtpRepository.update(
      { id: otpId },
      { isVerified: true },
    );
  }

  async markAirlineForgotPasswordOtpUsed(
    otpId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Marking airline forgot password OTP used",
      "AuthRepository",
      requestId,
      { otpId },
    );

    await this.airlinePasswordResetOtpRepository.update(
      { id: otpId },
      { isUsed: true },
    );
  }

  async updateAirlineUserPasswordHash(
    airlineUserId: number,
    passwordHash: string,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Updating airline user password hash",
      "AuthRepository",
      requestId,
      {
        airlineUserId,
      },
    );

    await this.airlineUserRepository.update(
      { id: airlineUserId },
      { passwordHash, requirePasswordReset: false },
    );
  }

  async saveAirlineTwoFactorTempSecret(
    airlineUserId: number,
    tempSecretEncrypted: string,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Saving airline 2FA temporary secret",
      "AuthRepository",
      requestId,
      { airlineUserId },
    );

    await this.airlineUserRepository.update(
      { id: airlineUserId },
      { twoFactorTempSecretEncrypted: tempSecretEncrypted },
    );
  }

  async enableAirlineTwoFactor(
    airlineUserId: number,
    secretEncrypted: string,
    recoveryCodeHashes: string[],
    requestId: string,
  ): Promise<void> {
    this.logger.debug("Enabling airline 2FA", "AuthRepository", requestId, {
      airlineUserId,
    });

    await this.airlineUserRepository.update(
      { id: airlineUserId },
      {
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: secretEncrypted,
        twoFactorTempSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: recoveryCodeHashes,
      },
    );
  }

  async disableAirlineTwoFactor(
    airlineUserId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug("Disabling airline 2FA", "AuthRepository", requestId, {
      airlineUserId,
    });

    await this.airlineUserRepository.update(
      { id: airlineUserId },
      {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorTempSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: null,
      },
    );
  }

  async createAirlineUser(
    payload: Pick<
      AirlineUserEntity,
      | "airlineId"
      | "firstName"
      | "lastName"
      | "email"
      | "jobTitle"
      | "passwordHash"
      | "role"
      | "isActive"
      | "requirePasswordReset"
    >,
    requestId: string,
  ): Promise<AirlineUserEntity> {
    this.logger.debug("Creating airline user", "AuthRepository", requestId, {
      airlineId: payload.airlineId,
      email: payload.email,
      role: payload.role,
    });

    const user = this.airlineUserRepository.create(payload);
    return this.airlineUserRepository.save(user);
  }
}
