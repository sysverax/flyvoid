import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, MoreThan, Repository } from "typeorm";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AirlineRole } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineEntity } from "../entities/airline.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";
import { AirlineAdminInviteEntity } from "../entities/airline-admin-invite.entity";
import { AIRLINE_INVITATION_STATUSES } from "../utils";
import {
  AIRLINE_INVITATION_HISTORY_EVENTS,
  AirlineAdminInviteHistoryEntity,
} from "../entities/airline-admin-invite-history.entity";
import { MetaAirlineInviteEntity } from "../entities/meta-airline-invite.entity";

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
    @InjectRepository(MetaAirlineInviteEntity)
    private readonly metaAirlineInviteRepository: Repository<MetaAirlineInviteEntity>,
    @InjectRepository(AirlineAdminInviteHistoryEntity)
    private readonly inviteHistoryRepository: Repository<AirlineAdminInviteHistoryEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findAirlineByCodeOrCompanyRegistrationNumber(
    code: string,
    companyRegistrationNumber: string,
    requestId: string,
    manager?: EntityManager,
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

    const repository = manager
      ? manager.getRepository(AirlineEntity)
      : this.airlineRepository;

    return repository.findOne({
      where: [{ code }, { companyRegistrationNumber }],
    });
  }

  async findAirlineUserByEmail(
    email: string,
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by email",
      "AirlineInvitationRepository",
      requestId,
      { email },
    );

    const repository = manager
      ? manager.getRepository(AirlineUserEntity)
      : this.airlineUserRepository;

    return repository.findOne({ where: { email } });
  }

  async lockAirlineAdminInviteById(
    inviteId: number,
    requestId: string,
    manager: EntityManager,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Locking airline admin invite by id for update",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    return manager
      .getRepository(AirlineAdminInviteEntity)
      .createQueryBuilder("invite")
      .setLock("pessimistic_write")
      .innerJoinAndSelect("invite.meta", "meta")
      .where("invite.id = :id", { id: inviteId })
      .getOne();
  }

  async recordInvitationHistory(
    payload: {
      invitationId: number;
      event: AIRLINE_INVITATION_HISTORY_EVENTS;
      performedByAdminId: number | null;
    },
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineAdminInviteHistoryEntity> {
    this.logger.debug(
      "Recording invitation history event",
      "AirlineInvitationRepository",
      requestId,
      { invitationId: payload.invitationId, event: payload.event },
    );

    const repository = manager
      ? manager.getRepository(AirlineAdminInviteHistoryEntity)
      : this.inviteHistoryRepository;

    const entry = repository.create(payload);
    return repository.save(entry);
  }

  async createAirline(
    payload: Pick<
      AirlineEntity,
      | "invitationId"
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
    manager?: EntityManager,
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

    const repository = manager
      ? manager.getRepository(AirlineEntity)
      : this.airlineRepository;

    const airline = repository.create(payload);
    return repository.save(airline);
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
    >,
    requestId: string,
    manager: EntityManager,
  ): Promise<AirlineUserEntity> {
    this.logger.debug(
      "Creating airline user",
      "AirlineInvitationRepository",
      requestId,
      { email: payload.email, airlineId: payload.airlineId },
    );

    const repository = manager.getRepository(AirlineUserEntity);
    const user = repository.create(payload);
    return repository.save(user);
  }

  async createMetaAirlineInvite(
    payload: Pick<
      MetaAirlineInviteEntity,
      | "airlineName"
      | "airlineCode"
      | "countryCode"
      | "companyRegistrationNumber"
      | "website"
      | "contactEmail"
      | "contactPhone"
      | "timezone"
      | "currency"
      | "address"
      | "logo"
      | "adminFirstName"
      | "adminLastName"
      | "adminEmail"
      | "adminJobTitle"
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<MetaAirlineInviteEntity> {
    this.logger.debug(
      "Creating meta airline invite",
      "AirlineInvitationRepository",
      requestId,
      {
        airlineCode: payload.airlineCode,
        adminEmail: payload.adminEmail,
      },
    );

    const repository = manager
      ? manager.getRepository(MetaAirlineInviteEntity)
      : this.metaAirlineInviteRepository;

    const metaInvite = repository.create(payload);
    return repository.save(metaInvite);
  }

  async createAirlineAdminInvite(
    payload: Pick<
      AirlineAdminInviteEntity,
      | "metaId"
      | "airlineId"
      | "invitedByAdminId"
      | "tokenLookup"
      | "tokenHash"
      | "expiresAt"
      | "status"
      | "acceptedAt"
      | "revokedAt"
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineAdminInviteEntity> {
    this.logger.debug(
      "Creating airline admin invite",
      "AirlineInvitationRepository",
      requestId,
      {
        metaId: payload.metaId,
        airlineId: payload.airlineId,
      },
    );

    const repository = manager
      ? manager.getRepository(AirlineAdminInviteEntity)
      : this.airlineAdminInviteRepository;

    const invite = repository.create(payload);
    return repository.save(invite);
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

    return this.airlineAdminInviteRepository
      .createQueryBuilder("invite")
      .innerJoinAndSelect("invite.meta", "meta")
      .where("meta.admin_email = :email", { email })
      .andWhere("invite.status = :pending", {
        pending: AIRLINE_INVITATION_STATUSES.PENDING,
      })
      .andWhere("invite.expires_at > :now", { now: new Date() })
      .orderBy("invite.created_at", "DESC")
      .getOne();
  }

  async findActiveMetaInviteByCodeOrCompanyRegistrationNumber(
    airlineCode: string,
    companyRegistrationNumber: string,
    requestId: string,
  ): Promise<MetaAirlineInviteEntity | null> {
    this.logger.debug(
      "Finding active meta invite by code or company registration number",
      "AirlineInvitationRepository",
      requestId,
      {
        airlineCode,
        companyRegistrationNumber,
      },
    );

    return this.metaAirlineInviteRepository
      .createQueryBuilder("meta")
      .innerJoin("meta.invitation", "invite")
      .where(
        "(meta.airline_code = :airlineCode OR meta.company_registration_number = :companyRegistrationNumber)",
        { airlineCode, companyRegistrationNumber },
      )
      .andWhere("invite.status = :pending", {
        pending: AIRLINE_INVITATION_STATUSES.PENDING,
      })
      .andWhere("invite.expires_at > :now", { now: new Date() })
      .orderBy("invite.created_at", "DESC")
      .getOne();
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
        status: AIRLINE_INVITATION_STATUSES.PENDING,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async findAirlineAdminInviteByTokenLookup(
    tokenLookup: string,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding airline admin invite by token lookup (all statuses)",
      "AirlineInvitationRepository",
      requestId,
      { tokenLookup },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: { tokenLookup, status: AIRLINE_INVITATION_STATUSES.PENDING },
      relations: { meta: true },
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
        status: AIRLINE_INVITATION_STATUSES.PENDING,
        expiresAt: MoreThan(new Date()),
      },
      relations: {
        meta: true,
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
        meta: true,
      },
    });
  }

  async findAirlineAdminInviteByIdWithHistory(
    inviteId: number,
    requestId: string,
  ): Promise<AirlineAdminInviteEntity | null> {
    this.logger.debug(
      "Finding airline admin invite by id with history",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    return this.airlineAdminInviteRepository.findOne({
      where: { id: inviteId },
      relations: {
        meta: true,
        airline: true,
        history: {
          performedByAdmin: true,
        },
      },
      order: {
        history: {
          createdAt: "ASC",
        },
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
          meta: true,
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
      {
        status: AIRLINE_INVITATION_STATUSES.REVOKED,
        revokedAt: new Date(),
      },
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

    await this.airlineAdminInviteRepository
      .createQueryBuilder()
      .update(AirlineAdminInviteEntity)
      .set({
        status: AIRLINE_INVITATION_STATUSES.REVOKED,
        revokedAt: () => "NOW()",
      })
      .where(
        `id IN (
          SELECT invite.id
          FROM airline_admin_invites invite
          INNER JOIN meta_airline_invites meta ON meta.id = invite.meta_id
          WHERE meta.admin_email = :email
            AND invite.status = :pending
            AND invite.expires_at > :now
        )`,
      )
      .setParameters({
        email,
        pending: AIRLINE_INVITATION_STATUSES.PENDING,
        now: new Date(),
      })
      .execute();
  }

  async refreshAirlineAdminInvite(
    inviteId: number,
    payload: Pick<
      AirlineAdminInviteEntity,
      | "invitedByAdminId"
      | "tokenLookup"
      | "tokenHash"
      | "expiresAt"
      | "status"
      | "acceptedAt"
      | "revokedAt"
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
        "SUM(CASE WHEN invite.status = :accepted THEN 1 ELSE 0 END)",
        "accepted",
      )
      .addSelect(
        "SUM(CASE WHEN invite.status = :revoked THEN 1 ELSE 0 END)",
        "revoked",
      )
      .addSelect(
        "SUM(CASE WHEN invite.status = :pending AND invite.expires_at > :now THEN 1 ELSE 0 END)",
        "pending",
      )
      .addSelect(
        "SUM(CASE WHEN invite.status = :pending AND invite.expires_at <= :now THEN 1 ELSE 0 END)",
        "expired",
      )
      .setParameters({
        now,
        accepted: AIRLINE_INVITATION_STATUSES.ACCEPTED,
        revoked: AIRLINE_INVITATION_STATUSES.REVOKED,
        pending: AIRLINE_INVITATION_STATUSES.PENDING,
      })
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
    airlineId: number,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug(
      "Marking airline admin invite accepted",
      "AirlineInvitationRepository",
      requestId,
      { inviteId },
    );

    const repository = manager
      ? manager.getRepository(AirlineAdminInviteEntity)
      : this.airlineAdminInviteRepository;

    await repository.update(
      { id: inviteId },
      {
        status: AIRLINE_INVITATION_STATUSES.ACCEPTED,
        acceptedAt: new Date(),
        revokedAt: null,
        airlineId,
      },
    );
  }
}
