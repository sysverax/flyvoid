import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import {
  AdminAirlineListResponseDto,
  AdminAirlineQueryDto,
  AdminAirlineResponseDto,
  AirlineAdminUserDto,
  UpdateAirlineRequestDto,
} from "../dto";
import { AirlineEntity } from "../entities/airline.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";
import { AirlineRepository } from "../repositories/airline.repository";
import { AirlineUserRepository } from "../repositories/airline-user.repository";

@Injectable()
export class AirlineService {
  private readonly context = "AirlineService";

  constructor(
    private readonly airlineRepository: AirlineRepository,
    private readonly airlineUserRepository: AirlineUserRepository,
    private readonly logger: LoggerService,
    private readonly dataSource: DataSource,
  ) {}

  async listAirlines(
    query: AdminAirlineQueryDto,
    requestId: string,
  ): Promise<AdminAirlineListResponseDto> {
    const { airlines, total } = await this.airlineRepository.findAll(
      query,
      requestId,
    );

    const airlineIds = airlines.map((a) => a.id);
    const adminUsers = await this.batchFindAdminsByAirlineIds(
      airlineIds,
      requestId,
    );

    return {
      total,
      currentPage: query.page,
      limit: query.limit,
      airlines: airlines.map((airline) =>
        this.toAirlineResponse(airline, adminUsers.get(airline.id) ?? null),
      ),
    };
  }

  async getAirlineById(
    airlineId: number,
    requestId: string,
  ): Promise<AdminAirlineResponseDto> {
    const airline = await this.airlineRepository.findById(airlineId, requestId);
    if (!airline) {
      throw new NotFoundException("Airline not found");
    }

    const adminUser = await this.airlineUserRepository.findAdminByAirlineId(
      airlineId,
      requestId,
    );

    return this.toAirlineResponse(airline, adminUser);
  }

  async updateAirline(
    airlineId: number,
    dto: UpdateAirlineRequestDto,
    requestId: string,
  ): Promise<AdminAirlineResponseDto> {
    // ── Reads & validation (outside transaction) ──────────────────────────

    const airline = await this.airlineRepository.findById(airlineId, requestId);
    if (!airline) {
      throw new NotFoundException("Airline not found");
    }

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      if (normalizedCode !== airline.code) {
        const existing = await this.airlineRepository.findByCode(
          normalizedCode,
          requestId,
        );
        if (existing) {
          throw new ConflictException("Airline code already exists");
        }
      }
    }

    if (dto.companyRegistrationNumber !== undefined) {
      const normalizedCRN = dto.companyRegistrationNumber.trim();
      if (normalizedCRN !== airline.companyRegistrationNumber) {
        const existing =
          await this.airlineRepository.findByCompanyRegistrationNumber(
            normalizedCRN,
            requestId,
          );
        if (existing) {
          throw new ConflictException(
            "Company registration number already exists",
          );
        }
      }
    }

    const airlineUpdate: Parameters<
      typeof this.airlineRepository.updateAirline
    >[1] = {};

    if (dto.name !== undefined) airlineUpdate.name = dto.name.trim();
    if (dto.code !== undefined)
      airlineUpdate.code = dto.code.trim().toUpperCase();
    if (dto.countryCode !== undefined)
      airlineUpdate.countryCode = dto.countryCode.trim().toUpperCase();
    if (dto.companyRegistrationNumber !== undefined)
      airlineUpdate.companyRegistrationNumber =
        dto.companyRegistrationNumber.trim();
    if (dto.website !== undefined)
      airlineUpdate.website =
        dto.website === null || dto.website === "" ? null : dto.website.trim();
    if (dto.contactEmail !== undefined)
      airlineUpdate.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined)
      airlineUpdate.contactPhone = dto.contactPhone.trim();
    if (dto.timezone !== undefined)
      airlineUpdate.timezone = dto.timezone.trim();
    if (dto.logo !== undefined)
      airlineUpdate.logo =
        dto.logo === null || dto.logo === "" ? null : dto.logo.trim();
    if (dto.currency !== undefined)
      airlineUpdate.currency = dto.currency.trim().toUpperCase();
    if (dto.address !== undefined) airlineUpdate.address = dto.address.trim();
    if (dto.isActive !== undefined) airlineUpdate.isActive = dto.isActive;
    if (dto.isSuspended !== undefined)
      airlineUpdate.isSuspended = dto.isSuspended;

    const adminUpdate: Parameters<
      typeof this.airlineUserRepository.updateAirlineUser
    >[1] = {};
    let adminUserId: number | null = null;

    const hasAdminUpdate =
      dto.adminFirstName !== undefined ||
      dto.adminLastName !== undefined ||
      dto.adminEmail !== undefined ||
      dto.adminJobTitle !== undefined;

    if (hasAdminUpdate) {
      const adminUser = await this.airlineUserRepository.findAdminByAirlineId(
        airlineId,
        requestId,
      );
      if (!adminUser) {
        throw new NotFoundException("Airline admin user not found");
      }

      if (dto.adminEmail !== undefined && dto.adminEmail !== adminUser.email) {
        const existing = await this.airlineUserRepository.findByEmail(
          dto.adminEmail,
          requestId,
        );
        if (existing) {
          throw new ConflictException("Admin email already exists");
        }
      }

      adminUserId = adminUser.id;
      if (dto.adminFirstName !== undefined)
        adminUpdate.firstName = dto.adminFirstName.trim();
      if (dto.adminLastName !== undefined)
        adminUpdate.lastName = dto.adminLastName.trim();
      if (dto.adminEmail !== undefined) adminUpdate.email = dto.adminEmail;
      if (dto.adminJobTitle !== undefined)
        adminUpdate.jobTitle = dto.adminJobTitle.trim();
    }

    // ── Writes (atomic transaction) ───────────────────────────────────────

    await this.dataSource.transaction(async (manager) => {
      if (Object.keys(airlineUpdate).length > 0) {
        await this.airlineRepository.updateAirline(
          airlineId,
          airlineUpdate,
          requestId,
          manager,
        );
      }

      if (adminUserId !== null && Object.keys(adminUpdate).length > 0) {
        await this.airlineUserRepository.updateAirlineUser(
          adminUserId,
          adminUpdate,
          requestId,
          manager,
        );
      }
    });

    this.logger.info("Airline updated successfully", this.context, requestId, {
      airlineId,
    });

    return this.getAirlineById(airlineId, requestId);
  }

  private async batchFindAdminsByAirlineIds(
    airlineIds: number[],
    requestId: string,
  ): Promise<Map<number, AirlineUserEntity>> {
    if (airlineIds.length === 0) {
      return new Map();
    }

    this.logger.debug(
      "Batch finding airline admins by airline ids",
      this.context,
      requestId,
      { count: airlineIds.length },
    );

    const admins = await Promise.all(
      airlineIds.map((id) =>
        this.airlineUserRepository.findAdminByAirlineId(id, requestId),
      ),
    );

    const map = new Map<number, AirlineUserEntity>();
    admins.forEach((admin, index) => {
      if (admin) {
        map.set(airlineIds[index], admin);
      }
    });

    return map;
  }

  private toAdminUserDto(
    user: AirlineUserEntity | null,
  ): AirlineAdminUserDto | null {
    if (!user) return null;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      jobTitle: user.jobTitle,
      isActive: user.isActive,
    };
  }

  private toAirlineResponse(
    airline: AirlineEntity,
    adminUser: AirlineUserEntity | null,
  ): AdminAirlineResponseDto {
    return {
      id: airline.id,
      name: airline.name,
      code: airline.code,
      countryCode: airline.countryCode,
      companyRegistrationNumber: airline.companyRegistrationNumber,
      website: airline.website ?? null,
      contactEmail: airline.contactEmail,
      contactPhone: airline.contactPhone,
      timezone: airline.timezone,
      logo: airline.logo ?? null,
      currency: airline.currency,
      address: airline.address,
      isActive: airline.isActive,
      isSuspended: airline.isSuspended,
      adminUser: this.toAdminUserDto(adminUser),
      createdAt: airline.createdAt.toISOString(),
      updatedAt: airline.updatedAt.toISOString(),
    };
  }
}
