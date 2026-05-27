import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import { AirlineRole } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineEntity } from "../entities/airline.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";
import { AirlineAdminInviteEntity } from "../entities/airline-admin-invite.entity";

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
        expiresAt: MoreThan(new Date()),
      },
    });
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
      { isAccepted: true },
    );
  }
}
