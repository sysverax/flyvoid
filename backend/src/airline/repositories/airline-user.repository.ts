import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { AirlineRole } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineUserEntity } from "../entities/airline-user.entity";

@Injectable()
export class AirlineUserRepository {
  constructor(
    @InjectRepository(AirlineUserEntity)
    private readonly airlineUserRepository: Repository<AirlineUserEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findByEmail(
    email: string,
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by email",
      "AirlineUserRepository",
      requestId,
      {
        email,
      },
    );

    const repository = manager
      ? manager.getRepository(AirlineUserEntity)
      : this.airlineUserRepository;

    return repository.findOne({ where: { email } });
  }

  async create(
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
      "AirlineUserRepository",
      requestId,
      {
        email: payload.email,
        airlineId: payload.airlineId,
      },
    );

    const repository = manager.getRepository(AirlineUserEntity);
    const user = repository.create(payload);
    return repository.save(user);
  }

  async countActiveAirlineAdminsByAirlineId(
    airlineId: number,
    requestId: string,
  ): Promise<number> {
    this.logger.debug(
      "Counting airline admins by airline id",
      "AirlineUserRepository",
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
}
