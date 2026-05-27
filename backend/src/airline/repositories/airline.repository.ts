import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineEntity } from "../entities/airline.entity";

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
}
