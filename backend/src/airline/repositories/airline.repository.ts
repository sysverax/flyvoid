import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { LoggerService } from "../../common/logger/logger.service";
import { AirlineEntity } from "../entities/airline.entity";
import { AdminAirlineQueryDto } from "../dto/admin-airline-query.dto";

@Injectable()
export class AirlineRepository {
  constructor(
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findByCodeOrCompanyRegistrationNumber(
    code: string,
    companyRegistrationNumber: string,
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineEntity | null> {
    this.logger.debug(
      "Finding airline by code or company registration number",
      "AirlineRepository",
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

  async create(
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
    this.logger.debug("Creating airline", "AirlineRepository", requestId, {
      code: payload.code,
      name: payload.name,
    });

    const repository = manager
      ? manager.getRepository(AirlineEntity)
      : this.airlineRepository;

    const airline = repository.create(payload);
    return repository.save(airline);
  }

  async findById(
    id: number,
    requestId: string,
  ): Promise<AirlineEntity | null> {
    this.logger.debug(
      "Finding airline by id",
      "AirlineRepository",
      requestId,
      { airlineId: id },
    );

    return this.airlineRepository.findOne({ where: { id } });
  }

  async findByCode(
    code: string,
    requestId: string,
  ): Promise<AirlineEntity | null> {
    this.logger.debug(
      "Finding airline by code",
      "AirlineRepository",
      requestId,
      { code },
    );

    return this.airlineRepository.findOne({ where: { code } });
  }

  async findByCompanyRegistrationNumber(
    companyRegistrationNumber: string,
    requestId: string,
  ): Promise<AirlineEntity | null> {
    this.logger.debug(
      "Finding airline by company registration number",
      "AirlineRepository",
      requestId,
      { companyRegistrationNumber },
    );

    return this.airlineRepository.findOne({
      where: { companyRegistrationNumber },
    });
  }

  async findAll(
    query: AdminAirlineQueryDto,
    requestId: string,
  ): Promise<{ airlines: AirlineEntity[]; total: number }> {
    this.logger.debug(
      "Listing all airlines",
      "AirlineRepository",
      requestId,
      {
        page: query.page,
        limit: query.limit,
        search: query.search,
        isActive: query.isActive,
        isSuspended: query.isSuspended,
      },
    );

    const qb = this.airlineRepository.createQueryBuilder("airline");

    if (query.search) {
      qb.where(
        "(airline.name ILIKE :search OR airline.code ILIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    if (query.isActive !== undefined) {
      qb.andWhere("airline.isActive = :isActive", {
        isActive: query.isActive,
      });
    }

    if (query.isSuspended !== undefined) {
      qb.andWhere("airline.isSuspended = :isSuspended", {
        isSuspended: query.isSuspended,
      });
    }

    qb.orderBy("airline.createdAt", "DESC");
    qb.skip((query.page - 1) * query.limit);
    qb.take(query.limit);

    const [airlines, total] = await qb.getManyAndCount();

    return { airlines, total };
  }

  async updateAirline(
    id: number,
    payload: Partial<
      Pick<
        AirlineEntity,
        | "name"
        | "code"
        | "countryCode"
        | "companyRegistrationNumber"
        | "website"
        | "contactEmail"
        | "contactPhone"
        | "timezone"
        | "logo"
        | "currency"
        | "address"
        | "isActive"
        | "isSuspended"
      >
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug(
      "Updating airline",
      "AirlineRepository",
      requestId,
      { airlineId: id, fields: Object.keys(payload) },
    );

    const repository = manager
      ? manager.getRepository(AirlineEntity)
      : this.airlineRepository;

    await repository.update({ id }, payload);
  }
}
