import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { AirportEntity } from "../entities/airport.entity";

@Injectable()
export class AirportRepository {
  constructor(
    @InjectRepository(AirportEntity)
    private readonly airportRepository: Repository<AirportEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findById(id: number, requestId: string): Promise<AirportEntity | null> {
    this.logger.debug("Finding airport by id", "AirportRepository", requestId, {
      airportId: id,
    });

    return this.airportRepository.findOne({ where: { id } });
  }

  async findByIataCode(
    iataCode: string,
    requestId: string,
  ): Promise<AirportEntity | null> {
    this.logger.debug(
      "Finding airport by iataCode",
      "AirportRepository",
      requestId,
      { iataCode },
    );

    return this.airportRepository.findOne({ where: { iataCode } });
  }

  async findByIcaoCode(
    icaoCode: string,
    requestId: string,
  ): Promise<AirportEntity | null> {
    this.logger.debug(
      "Finding airport by icaoCode",
      "AirportRepository",
      requestId,
      { icaoCode },
    );

    return this.airportRepository.findOne({ where: { icaoCode } });
  }

  create(payload: Partial<AirportEntity>): AirportEntity {
    return this.airportRepository.create(payload);
  }

  merge(entity: AirportEntity, payload: Partial<AirportEntity>): AirportEntity {
    return this.airportRepository.merge(entity, payload);
  }

  async save(entity: AirportEntity, requestId: string): Promise<AirportEntity> {
    this.logger.debug("Saving airport", "AirportRepository", requestId, {
      airportId: entity.id ?? null,
      iataCode: entity.iataCode,
      icaoCode: entity.icaoCode,
    });

    return this.airportRepository.save(entity);
  }
}
