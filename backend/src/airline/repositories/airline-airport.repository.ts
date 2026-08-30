import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineAirportEntity } from "../entities/airline-airport.entity";

@Injectable()
export class AirlineAirportRepository {
  constructor(
    @InjectRepository(AirlineAirportEntity)
    private readonly airlineAirportRepository: Repository<AirlineAirportEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findByAirlineAndAirportIds(
    airlineId: number,
    airportIds: number[],
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineAirportEntity[]> {
    this.logger.debug(
      "Finding airline-airport mappings by airline and airport ids",
      "AirlineAirportRepository",
      requestId,
      { airlineId, count: airportIds.length },
    );

    if (airportIds.length === 0) {
      return [];
    }

    const repository = manager
      ? manager.getRepository(AirlineAirportEntity)
      : this.airlineAirportRepository;

    return repository
      .createQueryBuilder("mapping")
      .where("mapping.airlineId = :airlineId", { airlineId })
      .andWhere("mapping.airportId IN (:...airportIds)", { airportIds })
      .getMany();
  }

  async bulkUpsertAssignments(
    payloads: Array<
      Pick<
        AirlineAirportEntity,
        | "airlineId"
        | "airportId"
        | "isActive"
        | "assignedByAdminId"
        | "assignedAt"
        | "disabledByAdminId"
        | "disabledAt"
      >
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug(
      "Bulk upserting airline-airport assignments",
      "AirlineAirportRepository",
      requestId,
      { count: payloads.length },
    );

    if (payloads.length === 0) {
      return;
    }

    const repository = manager
      ? manager.getRepository(AirlineAirportEntity)
      : this.airlineAirportRepository;

    await repository.upsert(payloads, {
      conflictPaths: ["airlineId", "airportId"],
      skipUpdateIfNoValuesChanged: true,
    });
  }

  async bulkDisableAssignments(
    airlineId: number,
    airportIds: number[],
    disabledByAdminId: number,
    disabledAt: Date,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug(
      "Bulk disabling airline-airport assignments",
      "AirlineAirportRepository",
      requestId,
      { airlineId, count: airportIds.length },
    );

    if (airportIds.length === 0) {
      return;
    }

    const repository = manager
      ? manager.getRepository(AirlineAirportEntity)
      : this.airlineAirportRepository;

    await repository
      .createQueryBuilder()
      .update(AirlineAirportEntity)
      .set({
        isActive: false,
        disabledByAdminId,
        disabledAt,
      })
      .where("airline_id = :airlineId", { airlineId })
      .andWhere("airport_id IN (:...airportIds)", { airportIds })
      .andWhere("is_active = :isActive", { isActive: true })
      .execute();
  }

  create(payload: Partial<AirlineAirportEntity>): AirlineAirportEntity {
    return this.airlineAirportRepository.create(payload);
  }

  async findAssignedAirportIdsByAirlineId(
    airlineId: number,
    requestId: string,
  ): Promise<number[]> {
    this.logger.debug(
      "Finding assigned airport ids by airline id",
      "AirlineAirportRepository",
      requestId,
      { airlineId },
    );
    const rows = await this.airlineAirportRepository.find({
      where: { airlineId: airlineId, isActive: true },
      select: ["airportId"],
    });

    return rows.map((row) => Number(row.airportId));
  }
}
