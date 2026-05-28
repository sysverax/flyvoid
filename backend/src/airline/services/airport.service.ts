import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuthenticatedUser } from "../../auth/interfaces/authenticated-request.interface";
import { LoggerService } from "../../common/logger/logger.service";
import { UserType } from "../../common/constants/user.constants";
import {
  AirportListResponseDto,
  AirportResponseDto,
  CreateAirportRequestDto,
  GetAirportsQueryDto,
  UpdateAirlineAirportsRequestDto,
  UpdateAirlineAirportsResponseDto,
  UpdateAirportRequestDto,
} from "../dto/airports";
import { AirlineEntity } from "../entities/airline.entity";
import { AirportEntity } from "../entities/airport.entity";
import { AirlineAirportRepository } from "../repositories/airline-airport.repository";
import { AirportRepository } from "../repositories/airport.repository";

@Injectable()
export class AirportService {
  private readonly context = "AirportService";

  constructor(
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    private readonly airportRepository: AirportRepository,
    private readonly airlineAirportRepository: AirlineAirportRepository,
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {}

  async createAirport(
    authenticatedUser: AuthenticatedUser,
    dto: CreateAirportRequestDto,
    requestId: string,
  ): Promise<AirportResponseDto> {
    await this.ensureUniqueCodes(
      dto.iataCode,
      dto.icaoCode,
      undefined,
      requestId,
    );

    const created = this.airportRepository.create({
      name: dto.name,
      iataCode: dto.iataCode,
      icaoCode: dto.icaoCode,
      countryCode: dto.countryCode,
      city: dto.city,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      isActive: dto.isActive,
      type: dto.type,
      address: dto.address ?? null,
      postalCode: dto.postalCode,
      createdBy: authenticatedUser.sub,
      updatedBy: authenticatedUser.sub,
    });

    const saved = await this.airportRepository.save(created, requestId);

    this.logger.info("Airport created", this.context, requestId, {
      airportId: saved.id,
      actorAdminId: authenticatedUser.sub,
      iataCode: saved.iataCode,
      icaoCode: saved.icaoCode,
    });

    return this.toAirportResponse(saved);
  }

  async listAirports(
    authenticatedUser: AuthenticatedUser,
    query: GetAirportsQueryDto,
    requestId: string,
  ): Promise<AirportListResponseDto> {
    const { airports, total } =
      authenticatedUser.userType === UserType.AIRLINE
        ? await this.airportRepository.findAllForAirline(
            query,
            authenticatedUser.airlineId!,
            requestId,
          )
        : await this.airportRepository.findAll(query, requestId);

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      airports: airports.map((airport) => this.toAirportResponse(airport)),
      total: total,
      currentPage: query.page,
      totalPages,
      limit: query.limit,
    };
  }

  async updateAirport(
    authenticatedUser: AuthenticatedUser,
    airportId: number,
    dto: UpdateAirportRequestDto,
    requestId: string,
  ): Promise<AirportResponseDto> {
    const existing = await this.airportRepository.findById(
      airportId,
      requestId,
    );
    if (!existing) {
      throw new NotFoundException("Airport not found");
    }

    if (dto.iataCode || dto.icaoCode) {
      await this.ensureUniqueCodes(
        dto.iataCode ?? existing.iataCode,
        dto.icaoCode ?? existing.icaoCode,
        existing.id,
        requestId,
      );
    }

    const next = this.airportRepository.merge(existing, {
      ...dto,
      address: dto.address ?? existing.address,
      postalCode: dto.postalCode ?? existing.postalCode,
      updatedBy: authenticatedUser.sub,
    });

    const saved = await this.airportRepository.save(next, requestId);

    this.logger.info("Airport updated", this.context, requestId, {
      airportId: saved.id,
      actorAdminId: authenticatedUser.sub,
    });

    return this.toAirportResponse(saved);
  }

  async updateAirlineAirports(
    authenticatedUser: AuthenticatedUser,
    airlineId: number,
    dto: UpdateAirlineAirportsRequestDto,
    requestId: string,
  ): Promise<UpdateAirlineAirportsResponseDto> {
    UpdateAirlineAirportsRequestDto.validatePayload(dto);

    const airline = await this.airlineRepository.findOne({
      where: { id: airlineId },
    });
    if (!airline) {
      throw new NotFoundException("Airline not found");
    }

    const assignAirportIds = [...new Set(dto.assignAirportIds ?? [])];
    const disableAirportIds = [...new Set(dto.disableAirportIds ?? [])];
    const allRequestedAirportIds = [
      ...new Set([...assignAirportIds, ...disableAirportIds]),
    ];

    const airports = await this.airportRepository.findByIds(
      allRequestedAirportIds,
      requestId,
    );
    const foundAirportIds = new Set(airports.map((airport) => airport.id));
    const missingAirportIds = allRequestedAirportIds.filter(
      (id) => !foundAirportIds.has(id),
    );
    if (missingAirportIds.length > 0) {
      throw new BadRequestException(
        `Invalid airport ids: ${missingAirportIds.join(", ")}`,
      );
    }

    const assignedAirportIds: number[] = [];
    const disabledAirportIds: number[] = [];

    await this.dataSource.transaction(async (manager) => {
      const existingMappings =
        await this.airlineAirportRepository.findByAirlineAndAirportIds(
          airlineId,
          allRequestedAirportIds,
          requestId,
          manager,
        );

      const mappingByAirportId = new Map<
        number,
        (typeof existingMappings)[number]
      >();
      for (const mapping of existingMappings) {
        mappingByAirportId.set(mapping.airportId, mapping);
      }

      const now = new Date();

      for (const airportId of assignAirportIds) {
        const existing = mappingByAirportId.get(airportId);
        if (!existing || !existing.isActive) {
          assignedAirportIds.push(airportId);
        }
      }

      for (const airportId of disableAirportIds) {
        const existing = mappingByAirportId.get(airportId);
        if (existing?.isActive) {
          disabledAirportIds.push(airportId);
        }
      }

      await this.airlineAirportRepository.bulkUpsertAssignments(
        assignedAirportIds.map((airportId) => ({
          airlineId,
          airportId,
          isActive: true,
          assignedByAdminId: authenticatedUser.sub,
          assignedAt: now,
          disabledByAdminId: null,
          disabledAt: null,
        })),
        requestId,
        manager,
      );

      await this.airlineAirportRepository.bulkDisableAssignments(
        airlineId,
        disabledAirportIds,
        authenticatedUser.sub,
        now,
        requestId,
        manager,
      );
    });

    const currentActiveAirportIds =
      await this.airlineAirportRepository.findActiveAirportIdsByAirlineId(
        airlineId,
        requestId,
      );

    this.logger.info(
      "Airline airport assignments updated",
      this.context,
      requestId,
      {
        airlineId,
        actorAdminId: authenticatedUser.sub,
        assignedCount: assignedAirportIds.length,
        disabledCount: disabledAirportIds.length,
        totalActiveAirports: currentActiveAirportIds.length,
      },
    );

    return {
      airlineId,
      assignedAirportIds,
      disabledAirportIds,
      activeAirportIds: currentActiveAirportIds,
      totalActiveAirports: currentActiveAirportIds.length,
    };
  }

  private async ensureUniqueCodes(
    iataCode: string,
    icaoCode: string,
    ignoreAirportId?: number,
    requestId?: string,
  ): Promise<void> {
    const [sameIata, sameIcao] = await Promise.all([
      this.airportRepository.findByIataCode(iataCode, requestId ?? ""),
      this.airportRepository.findByIcaoCode(icaoCode, requestId ?? ""),
    ]);

    if (sameIata && sameIata.id !== ignoreAirportId) {
      throw new ConflictException("Airport IATA code already exists");
    }

    if (sameIcao && sameIcao.id !== ignoreAirportId) {
      throw new ConflictException("Airport ICAO code already exists");
    }
  }

  private toAirportResponse(entity: AirportEntity): AirportResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      iataCode: entity.iataCode,
      icaoCode: entity.icaoCode,
      countryCode: entity.countryCode,
      city: entity.city,
      latitude: Number(entity.latitude),
      longitude: Number(entity.longitude),
      timezone: entity.timezone,
      isActive: entity.isActive,
      type: entity.type,
      address: entity.address ?? null,
      postalCode: entity.postalCode ?? null,
      // createdBy: entity.createdBy,
      // updatedBy: entity.updatedBy ?? null,
      // createdAt: entity.createdAt.toISOString(),
      // updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
