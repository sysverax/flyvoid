import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, MoreThan, Repository } from "typeorm";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineAdminInviteEntity } from "../entities/airline-admin-invite.entity";
import { AIRLINE_INVITATION_STATUSES } from "../constants";
import {
  AIRLINE_INVITATION_HISTORY_EVENTS,
  AirlineAdminInviteHistoryEntity,
} from "../entities/airline-admin-invite-history.entity";
import { MetaAirlineInviteEntity } from "../entities/meta-airline-invite.entity";
import { AirlineInvitationListRequestDto } from "../dto/airline-invitation/airline-invitation-list-request.dto";

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
    @InjectRepository(AirlineAdminInviteEntity)
    private readonly airlineAdminInviteRepository: Repository<AirlineAdminInviteEntity>,
    @InjectRepository(MetaAirlineInviteEntity)
    private readonly metaAirlineInviteRepository: Repository<MetaAirlineInviteEntity>,
    @InjectRepository(AirlineAdminInviteHistoryEntity)
    private readonly inviteHistoryRepository: Repository<AirlineAdminInviteHistoryEntity>,
    private readonly logger: LoggerService,
  ) {}

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
      | "creditLimit"
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
    query: AirlineInvitationListRequestDto,
    requestId: string,
  ): Promise<{ invitations: AirlineAdminInviteEntity[]; total: number }> {
    this.logger.debug(
      "Listing airline invitations",
      "AirlineInvitationRepository",
      requestId,
      {
        page: query.page,
        limit: query.limit,
      },
    );

    const skip = (query.page - 1) * query.limit;

    const queryBuilder = this.airlineAdminInviteRepository
      .createQueryBuilder("invite")
      .innerJoinAndSelect("invite.meta", "meta")
      .select([
        "invite.id",
        "invite.airlineId",
        "invite.metaId",
        "invite.expiresAt",
        "invite.status",
        "invite.acceptedAt",
        "invite.revokedAt",
        "invite.createdAt",
        "invite.updatedAt",
        "invite.invitedByAdminId",
        "meta.id",
        "meta.airlineName",
        "meta.airlineCode",
        "meta.countryCode",
        "meta.companyRegistrationNumber",
        "meta.contactEmail",
        "meta.creditLimit",
      ]);

    if (query.countryCode) {
      queryBuilder.andWhere("meta.country_code = :countryCode", {
        countryCode: query.countryCode,
      });
    }

    if (query.validStatuses && query.validStatuses.length > 0) {
      const hasPending = query.validStatuses.includes(
        AIRLINE_INVITATION_STATUSES.PENDING,
      );
      const hasExpired = query.validStatuses.includes(
        AIRLINE_INVITATION_STATUSES.EXPIRED,
      );
      const otherStatuses = query.validStatuses.filter(
        (s) =>
          s !== AIRLINE_INVITATION_STATUSES.PENDING &&
          s !== AIRLINE_INVITATION_STATUSES.EXPIRED,
      );

      const conditions: string[] = [];
      const params: Record<string, unknown> = {};

      // PENDING and EXPIRED both map to status='PENDING' rows, split by expires_at
      if (hasPending && hasExpired) {
        conditions.push("invite.status = :pendingStatus");
        params.pendingStatus = AIRLINE_INVITATION_STATUSES.PENDING;
      } else if (hasPending) {
        conditions.push(
          "(invite.status = :pendingStatus AND invite.expires_at > :now)",
        );
        params.pendingStatus = AIRLINE_INVITATION_STATUSES.PENDING;
        params.now = new Date();
      } else if (hasExpired) {
        conditions.push(
          "(invite.status = :pendingStatus AND invite.expires_at <= :now)",
        );
        params.pendingStatus = AIRLINE_INVITATION_STATUSES.PENDING;
        params.now = new Date();
      }

      if (otherStatuses.length > 0) {
        conditions.push("invite.status IN (:...otherStatuses)");
        params.otherStatuses = otherStatuses;
      }

      queryBuilder.andWhere(`(${conditions.join(" OR ")})`, params);
    }

    if (query.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        "(LOWER(meta.contact_email) LIKE :searchTerm OR LOWER(meta.airline_name) LIKE :searchTerm)",
        { searchTerm },
      );
    }

    return queryBuilder
      .orderBy("invite.createdAt", "DESC")
      .skip(skip)
      .take(query.limit)
      .getManyAndCount()
      .then(([invitations, total]) => ({ invitations, total }));
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

  async updateMetaAirlineInvite(
    metaId: number,
    payload: Partial<
      Pick<
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
        | "creditLimit"
        | "adminFirstName"
        | "adminLastName"
        | "adminEmail"
        | "adminJobTitle"
      >
    >,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Updating meta airline invite",
      "AirlineInvitationRepository",
      requestId,
      { metaId },
    );

    await this.metaAirlineInviteRepository.update({ id: metaId }, payload);
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
