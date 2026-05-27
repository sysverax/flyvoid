import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AirlineRole } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineEntity } from "../entities/airline.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";
import { AirlineAdminInviteEntity } from "../entities/airline-admin-invite.entity";

export interface AirlineInvitationMatrixCounts {
  totalSent: number;
  accepted: number;
  pending: number;
  expired: number;
  revoked: number;
}

@Injectable()
export class AirlineInvitationRepository {
  constructor(
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    @InjectRepository(AirlineUserEntity)
    private readonly airlineUserRepository: Repository<AirlineUserEntity>,
    @InjectRepository(AirlineAdminInviteEntity)
    private readonly airlineAdminInviteRepository: Repository<AirlineAdminInviteEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findAirlineByCodeOrCompanyRegistrationNumber(
    code: string,
    companyRegistrationNumber: string,
    requestId: string,
  ): Promise<AirlineEntity | null> {
    this.logger.debug(
      "Finding airline by code or company registration number",
      "AirlineInvitationRepository",
      requestId,
      {
        code,
        companyRegistrationNumber,
      },
    );

    return this.airlineRepository.findOne({
      where: [{ code }, { companyRegistrationNumber }],
    });
  }

  async findAirlineUserByEmail(
    email: string,
    requestId: string,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by email",
      "AirlineInvitationRepository",
      requestId,
      { email },
    );

    return this.airlineUserRepository.findOne({ where: { email } });
  }

  async createAirline(
    payload: Pick<
      AirlineEntity,
      | "name"
      | "code"
      | "countryCode"
      | "companyRegistrationNumber"
      | "website"
      | "contactEmail"
      | "contactPhone"
      | "timezone"
      | "currency"
      | "address"
      | "logo"
      | "isActive"
    >,
    requestId: string,
  ): Promise<AirlineEntity> {
    this.logger.debug(
      "Creating airline",
      "AirlineInvitationRepository",
      requestId,
      {
        code: payload.code,
        name: payload.name,
      },
    );

    const airline = this.airlineRepository.create(payload);
    return this.airlineRepository.save(airline);
  }

  async createAirlineAdminInvite(
    payload: Pick<
      AirlineAdminInviteEntity,
      | "airlineId"
      | "invitedByAdminId"
      | "firstName"
      | "lastName"
      | "email"
      | "jobTitle"
      | "tokenLookup"
      | "tokenHash"
      | "expiresAt"
      | "isAccepted"
      | "isRevoked"
    >,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity> {
    this.logger.debug(
      "Creating airline admin invite",
      "AirlineInvitationRepository",
      requestId,
      {
        airlineId: payload.airlineId,
        email: payload.email,
      },
    );

    const invite = this.airlineAdminInviteRepository.create(payload);
    return this.airlineAdminInviteRepository.save(invite);
  }

  async findActiveAirlineAdminInviteByEmail(
    email: string,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding active airline admin invite by email",
      "AirlineInvitationRepository",
      requestId,
      { email },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: {
        email,
        isAccepted: false,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findActiveAirlineAdminInviteByAirlineId(
    airlineId: number,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding active airline admin invite by airline id",
      "AirlineInvitationRepository",
      requestId,
      { airlineId },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: {
        airlineId,
        isAccepted: false,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findPendingAirlineAdminInviteById(
    inviteId: number,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding pending airline admin invite by id",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: {
        id: inviteId,
        isAccepted: false,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async findPendingAirlineAdminInviteByLookup(
    tokenLookup: string,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding pending airline admin invite by token lookup",
      "AirlineInvitationRepository",
      requestId,
      { tokenLookup },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: {
        tokenLookup,
        isAccepted: false,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async findAirlineAdminInviteById(
    inviteId: number,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding airline admin invite by id",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: { id: inviteId },
      relations: {
        airline: true,
      },
    });
  }

  async findAllInvitations(
    pagination: PaginationQueryDto,
    requestId: string,
  ): Promise<{ invitations: AirlineAdminInviteEntity[]; total: number }> {
    this.logger.debug(
      "Listing airline invitations",
      "AirlineInvitationRepository",
      requestId,
      {
        page: pagination.page,
        limit: pagination.limit,
      },
    );

    const skip = (pagination.page - 1) * pagination.limit;

    const [invitations, total] =
      await this.airlineAdminInviteRepository.findAndCount({
        relations: {
          airline: true,
        },
        order: {
          createdAt: "DESC",
        },
        skip,
        take: pagination.limit,
      });

    return { invitations, total };
  }

  async revokeAirlineAdminInvite(
    inviteId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Revoking airline admin invite",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    await this.airlineAdminInviteRepository.update(
      { id: inviteId },
      { isRevoked: true },
    );
  }

  async revokeActiveAirlineAdminInvitesByEmail(
    email: string,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Revoking active airline admin invites by email",
      "AirlineInvitationRepository",
      requestId,
      { email },
    );

    await this.airlineAdminInviteRepository.update(
      {
        email,
        isAccepted: false,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      { isRevoked: true },
    );
  }

  async refreshAirlineAdminInvite(
    inviteId: number,
    payload: Pick<
      AirlineAdminInviteEntity,
      | "invitedByAdminId"
      | "tokenLookup"
      | "tokenHash"
      | "expiresAt"
      | "isAccepted"
      | "isRevoked"
    >,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Refreshing airline admin invite token",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    await this.airlineAdminInviteRepository.update({ id: inviteId }, payload);
  }

  async getInvitationMatrix(
    requestId: string,
  ): Promise<AirlineInvitationMatrixCounts> {
    this.logger.debug(
      "Getting airline invitation matrix",
      "AirlineInvitationRepository",
      requestId,
    );

    const now = new Date();

    const raw = await this.airlineAdminInviteRepository
      .createQueryBuilder("invite")
      .select("COUNT(*)", "totalSent")
      .addSelect(
        "SUM(CASE WHEN invite.is_accepted = true THEN 1 ELSE 0 END)",
        "accepted",
      )
      .addSelect(
        "SUM(CASE WHEN invite.is_accepted = false AND invite.is_revoked = true THEN 1 ELSE 0 END)",
        "revoked",
      )
      .addSelect(
        "SUM(CASE WHEN invite.is_accepted = false AND invite.is_revoked = false AND invite.expires_at > :now THEN 1 ELSE 0 END)",
        "pending",
      )
      .addSelect(
        "SUM(CASE WHEN invite.is_accepted = false AND invite.is_revoked = false AND invite.expires_at <= :now THEN 1 ELSE 0 END)",
        "expired",
      )
      .setParameter("now", now)
      .getRawOne<{
        totalSent: string | null;
        accepted: string | null;
        revoked: string | null;
        pending: string | null;
        expired: string | null;
      }>();

    return {
      totalSent: Number(raw?.totalSent ?? 0),
      accepted: Number(raw?.accepted ?? 0),
      revoked: Number(raw?.revoked ?? 0),
      pending: Number(raw?.pending ?? 0),
      expired: Number(raw?.expired ?? 0),
    };
  }

  async countAirlineAdminsByAirlineId(
    airlineId: number,
    requestId: string,
  ): Promise<number> {
    this.logger.debug(
      "Counting airline admins by airline id",
      "AirlineInvitationRepository",
      requestId,
      { airlineId },
    );

    return this.airlineUserRepository.count({
      where: {
        airlineId,
        role: AirlineRole.AIRLINE_ADMIN,
        isActive: true,
      },
    });
  }

  async markAirlineAdminInviteAccepted(
    inviteId: number,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Marking airline admin invite accepted",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    await this.airlineAdminInviteRepository.update(
      { id: inviteId },
      { isAccepted: true, isRevoked: false },
    );
  }
}
