import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminEntity } from "../../admin/entities/admin.entity";
import { AuthenticatedUser } from "../../auth/interfaces/authenticated-request.interface";
import { AdminRole, UserType } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import {
  AirportResponseDto,
  CreateAirportRequestDto,
  UpdateAirportRequestDto,
} from "../dto";
import { AirportEntity } from "../entities/airport.entity";
import { AirportRepository } from "../repositories/airport.repository";

@Injectable()
export class AirportService {
  private readonly context = "AirportService";

  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    private readonly airportRepository: AirportRepository,
    private readonly logger: LoggerService,
  ) {}

  async createAirport(
    authenticatedUser: AuthenticatedUser,
    dto: CreateAirportRequestDto,
    requestId: string,
  ): Promise<AirportResponseDto> {
    const actor = await this.requirePlatformEditor(
      authenticatedUser,
      requestId,
    );

    await this.ensureUniqueCodes(dto.iataCode, dto.icaoCode, undefined, requestId);

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
      createdBy: actor.id,
      updatedBy: actor.id,
    });

    const saved = await this.airportRepository.save(created, requestId);

    this.logger.info("Airport created", this.context, requestId, {
      airportId: saved.id,
      actorAdminId: actor.id,
      iataCode: saved.iataCode,
      icaoCode: saved.icaoCode,
    });

    return this.toAirportResponse(saved);
  }

  async updateAirport(
    authenticatedUser: AuthenticatedUser,
    airportId: number,
    dto: UpdateAirportRequestDto,
    requestId: string,
  ): Promise<AirportResponseDto> {
    const actor = await this.requirePlatformEditor(
      authenticatedUser,
      requestId,
    );

    const existing = await this.airportRepository.findById(airportId, requestId);
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
      updatedBy: actor.id,
    });

    const saved = await this.airportRepository.save(next, requestId);

    this.logger.info("Airport updated", this.context, requestId, {
      airportId: saved.id,
      actorAdminId: actor.id,
    });

    return this.toAirportResponse(saved);
  }

  private async requirePlatformEditor(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AdminEntity> {
    if (authenticatedUser.userType !== UserType.PLATFORM) {
      throw new UnauthorizedException("Unauthorized");
    }

    const admin = await this.adminRepository.findOne({
      where: { id: authenticatedUser.sub },
    });

    if (!admin) {
      throw new UnauthorizedException("Admin not found");
    }

    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    if (![AdminRole.SUPER_ADMIN, AdminRole.STAFF].includes(admin.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    this.logger.debug("Platform editor verified", this.context, requestId, {
      adminId: admin.id,
      role: admin.role,
    });

    return admin;
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
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
