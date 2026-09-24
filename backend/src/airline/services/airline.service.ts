import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import {
  AdminAirlineListResponseDto,
  AdminAirlineQueryDto,
  AdminAirlineResponseDto,
  AirlineAdminDetailsDto,
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

    return {
      total,
      currentPage: query.page,
      limit: query.limit,
      airlines: airlines.map((airline) => ({
        id: airline.id,
        name: airline.name,
        code: airline.code,
        countryCode: airline.countryCode,
        platformFeePercentage: Number(airline.platformFeePercentage),
        isActive: airline.isActive,
        isSuspended: airline.isSuspended,
        wallet: {
          id: airline.wallet.id,
          balance: Number(airline.wallet.balance),
          creditLimit: Number(airline.wallet.creditLimit),
          lockedAmount: Number(airline.wallet.lockedAmount),
        },
        createdAt: airline.createdAt.toISOString(),
        updatedAt: airline.updatedAt.toISOString(),
      })),
    };
  }

  async getAirlineById(
    airlineId: number,
    requestId: string,
  ): Promise<AdminAirlineResponseDto> {
    const [airline, adminUser, totals] = await Promise.all([
      this.airlineRepository.findByIdWithWallet(airlineId, requestId),
      this.airlineUserRepository.findAdminByAirlineId(airlineId, requestId),
      this.airlineRepository.getOperationalAndFinancialTotals(
        airlineId,
        requestId,
      ),
    ]);

    console.log({ airline, adminUser, totals });

    if (!airline) {
      throw new NotFoundException("Airline not found");
    }
    if (!adminUser) {
      throw new NotFoundException("Airline admin user not found");
    }

    if (!airline.wallet) {
      throw new InternalServerErrorException(
        "Airline wallet is not configured",
      );
    }

    return {
      airlineDetails: {
        id: airline.id,
        name: airline.name,
        code: airline.code,
        countryCode: airline.countryCode,
        companyRegistrationNumber: airline.companyRegistrationNumber,
        website: airline.website ?? null,
        contactEmail: airline.contactEmail,
        contactPhone: airline.contactPhone,
        timezone: airline.timezone,
        currency: airline.currency,
        address: airline.address,
        createdAt: airline.createdAt.toISOString(),
        updatedAt: airline.updatedAt.toISOString(),
        isActive: airline.isActive,
        isSuspended: airline.isSuspended,
      },
      adminDetails: this.toAdminDetailsDto(adminUser),
      operationalMetrics: {
        totalOngoingCancelledFlights: totals.totalOngoingCancelledFlights,
        totalCancelledFlights: totals.totalCancelledFlights,
        totalChildren: totals.totalChildren,
        totalAdults: totals.totalAdults,
        totalBookings: totals.totalBookings,
        totalRooms: totals.totalRooms,
      },
      financialSummary: {
        walletId: airline.wallet.id,
        creditLimit: Number(airline.wallet.creditLimit),
        balance: Number(airline.wallet.balance),
        lockedAmount: Number(airline.wallet.lockedAmount),
        platformFeePercentage: Number(airline.platformFeePercentage),
        totalActualPrice: totals.totalActualPrice,
        totalBuyingPrice: totals.totalBuyingPrice,
        totalSellingPrice: totals.totalSellingPrice,
        totalDiscounts: totals.totalDiscounts,
        totalHotelTaxes: totals.totalHotelTaxes,
        totalPlatformFee: totals.totalPlatformFee,
        totalPrice: totals.totalPrice,
        totalEarnings: totals.totalEarnings,
      },
    };
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
    if (dto.platformFeePercentage !== undefined)
      airlineUpdate.platformFeePercentage = dto.platformFeePercentage;
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

  private toAdminDetailsDto(user: AirlineUserEntity): AirlineAdminDetailsDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      jobTitle: user.jobTitle,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      isActive: user.isActive,
    };
  }
}
