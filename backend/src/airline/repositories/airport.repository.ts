import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { AirportEntity } from "../entities/airport.entity";
import { GetAirportsQueryDto } from "../dto/airports";

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

  async findByIds(ids: number[], requestId: string): Promise<AirportEntity[]> {
    this.logger.debug(
      "Finding airports by ids",
      "AirportRepository",
      requestId,
      {
        count: ids.length,
      },
    );

    if (ids.length === 0) {
      return [];
    }

    return this.airportRepository
      .createQueryBuilder("airport")
      .where("airport.id IN (:...ids)", { ids })
      .getMany();
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

  async findAll(
    query: GetAirportsQueryDto,
    requestId: string,
  ): Promise<{ airports: AirportEntity[]; total: number }> {
    this.logger.debug("Listing airports", "AirportRepository", requestId, {
      page: query.page,
      limit: query.limit,
      countryCode: query.countryCode ?? null,
      status: query.status ?? null,
      search: query.search ?? null,
    });

    const qb = this.airportRepository.createQueryBuilder("airport");

    if (query.countryCode) {
      qb.andWhere("airport.countryCode = :countryCode", {
        countryCode: query.countryCode,
      });
    }

    if (query.status !== undefined) {
      qb.andWhere("airport.isActive = :status", { status: query.status });
    }

    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where("LOWER(airport.name) LIKE :search", { search })
            .orWhere("LOWER(airport.iataCode) LIKE :search", { search })
            .orWhere("LOWER(airport.icaoCode) LIKE :search", { search })
            .orWhere("LOWER(airport.city) LIKE :search", { search })
            .orWhere("LOWER(airport.countryCode) LIKE :search", { search });
        }),
      );
    }

    const skip = (query.page - 1) * query.limit;

    const [airports, total] = await qb
      .orderBy("airport.createdAt", "DESC")
      .skip(skip)
      .take(query.limit)
      .getManyAndCount();

    return { airports, total };
  }

  async findAllForAirline(
    query: GetAirportsQueryDto,
    airlineId: number,
    requestId: string,
  ): Promise<{ airports: AirportEntity[]; total: number }> {
    this.logger.debug(
      "Listing airports for airline",
      "AirportRepository",
      requestId,
      {
        airlineId,
        page: query.page,
        limit: query.limit,
        countryCode: query.countryCode ?? null,
        search: query.search ?? null,
      },
    );

    const qb = this.airportRepository
      .createQueryBuilder("airport")
      .innerJoin(
        "airport.airlines",
        "mapping",
        "mapping.airlineId = :airlineId AND mapping.isActive = :mappingActive",
        { airlineId, mappingActive: true },
      )
      .where("airport.isActive = :airportActive", { airportActive: true });

    if (query.countryCode) {
      qb.andWhere("airport.countryCode = :countryCode", {
        countryCode: query.countryCode,
      });
    }

    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where("LOWER(airport.name) LIKE :search", { search })
            .orWhere("LOWER(airport.iataCode) LIKE :search", { search })
            .orWhere("LOWER(airport.icaoCode) LIKE :search", { search })
            .orWhere("LOWER(airport.city) LIKE :search", { search })
            .orWhere("LOWER(airport.countryCode) LIKE :search", { search });
        }),
      );
    }

    const skip = (query.page - 1) * query.limit;

    const [airports, total] = await qb
      .orderBy("airport.createdAt", "DESC")
      .skip(skip)
      .take(query.limit)
      .getManyAndCount();

    return { airports, total };
  }
}
