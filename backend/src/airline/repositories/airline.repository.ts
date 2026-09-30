import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { LoggerService } from "../../common/logger/logger.service";
import { AirlineEntity } from "../entities/airline.entity";
import { AdminAirlineQueryDto } from "../dto/admin-airline-query.dto";
import { CancelledFlightEntity } from "../../cancelled-flights/entities/cancelled-flight.entity";
import { FlightStatus } from "../../cancelled-flights/entities/enums";

const ONGOING_CANCELLED_FLIGHT_STATUSES = [
  FlightStatus.DRAFT,
  FlightStatus.IN_PROGRESS,
  FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
  FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
];

const FINALIZED_CANCELLED_FLIGHT_STATUSES = [
  FlightStatus.ALLOCATED,
  FlightStatus.PAID,
  FlightStatus.PUBLISHED,
];

@Injectable()
export class AirlineRepository {
  constructor(
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    @InjectRepository(CancelledFlightEntity)
    private readonly cancelledFlightRepository: Repository<CancelledFlightEntity>,
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
      | "platformFeePercentage"
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

  async findById(id: number, requestId: string): Promise<AirlineEntity | null> {
    this.logger.debug("Finding airline by id", "AirlineRepository", requestId, {
      airlineId: id,
    });

    return this.airlineRepository.findOne({ where: { id } });
  }

  async findByIdWithWallet(
    id: number,
    requestId: string,
  ): Promise<AirlineEntity | null> {
    this.logger.debug(
      "Finding airline by id with wallet",
      "AirlineRepository",
      requestId,
      { airlineId: id },
    );

    return this.airlineRepository.findOne({
      where: { id },
      relations: ["wallet"],
    });
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
    this.logger.debug("Listing all airlines", "AirlineRepository", requestId, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      countryCode: query.countryCode,
      isActive: query.isActive,
      isSuspended: query.isSuspended,
    });

    const qb = this.airlineRepository
      .createQueryBuilder("airline")
      .leftJoinAndSelect("airline.wallet", "wallet");

    if (query.search) {
      qb.where("(airline.name ILIKE :search OR airline.code ILIKE :search)", {
        search: `%${query.search}%`,
      });
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

    if (query.countryCode) {
      qb.andWhere("airline.countryCode = :countryCode", {
        countryCode: query.countryCode,
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
        | "platformFeePercentage"
      >
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug("Updating airline", "AirlineRepository", requestId, {
      airlineId: id,
      fields: Object.keys(payload),
    });

    const repository = manager
      ? manager.getRepository(AirlineEntity)
      : this.airlineRepository;

    await repository.update({ id }, payload);
  }

  // ── Operational / financial summary ─────────────────────────────────────

  /** Ongoing count is over cancelled flights still in progress; every other
   * total here only considers flights that reached a final status
   * (allocated, paid, published) — draft/in-progress flights haven't
   * settled their passenger/room/price totals yet. */
  async getOperationalAndFinancialTotals(
    airlineId: number,
    requestId: string,
  ): Promise<{
    totalOngoingCancelledFlights: number;
    totalCancelledFlights: number;
    totalChildren: number;
    totalAdults: number;
    totalBookings: number;
    totalRooms: number;
    totalActualPrice: number;
    totalBuyingPrice: number;
    totalSellingPrice: number;
    totalDiscounts: number;
    totalHotelTaxes: number;
    totalPlatformFee: number;
    totalPrice: number;
    totalEarnings: number;
  }> {
    this.logger.debug(
      "Querying airline operational and financial totals",
      "AirlineRepository",
      requestId,
      { airlineId },
    );

    const [ongoingRaw, finalizedRaw] = await Promise.all([
      this.cancelledFlightRepository
        .createQueryBuilder("cancelledFlight")
        .where("cancelledFlight.airlineId = :airlineId", { airlineId })
        .andWhere("cancelledFlight.status IN (:...statuses)", {
          statuses: ONGOING_CANCELLED_FLIGHT_STATUSES,
        })
        .select("COUNT(cancelledFlight.id)", "totalOngoingCancelledFlights")
        .getRawOne<{ totalOngoingCancelledFlights: string }>(),
      this.cancelledFlightRepository
        .createQueryBuilder("cancelledFlight")
        .where("cancelledFlight.airlineId = :airlineId", { airlineId })
        .andWhere("cancelledFlight.status IN (:...statuses)", {
          statuses: FINALIZED_CANCELLED_FLIGHT_STATUSES,
        })
        .select("COUNT(cancelledFlight.id)", "totalCancelledFlights")
        .addSelect(
          "COALESCE(SUM(cancelledFlight.totalChildren), 0)",
          "totalChildren",
        )
        .addSelect(
          "COALESCE(SUM(cancelledFlight.totalAdults), 0)",
          "totalAdults",
        )
        .addSelect(
          "COALESCE(SUM(cancelledFlight.totalBooking), 0)",
          "totalBookings",
        )
        .addSelect(
          "COALESCE(SUM(cancelledFlight.totalHotelRooms), 0)",
          "totalRooms",
        )
        // COALESCE only guards against SUM(NULL) (no matching rows). Postgres
        // numeric also has a distinct NaN value, which a bad upstream write
        // can leave sitting in one row's price columns — SUM propagates it,
        // silently poisoning the whole airline's total, and COALESCE can't
        // catch it since NaN isn't NULL. Each CASE strips a NaN value down
        // to 0 before it ever reaches SUM.
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalActualPrice = 'NaN' THEN 0 ELSE cancelledFlight.totalActualPrice END), 0)",
          "totalActualPrice",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalBuyingPrice = 'NaN' THEN 0 ELSE cancelledFlight.totalBuyingPrice END), 0)",
          "totalBuyingPrice",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalSellingPrice = 'NaN' THEN 0 ELSE cancelledFlight.totalSellingPrice END), 0)",
          "totalSellingPrice",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalDiscounts = 'NaN' THEN 0 ELSE cancelledFlight.totalDiscounts END), 0)",
          "totalDiscounts",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalHotelTaxes = 'NaN' THEN 0 ELSE cancelledFlight.totalHotelTaxes END), 0)",
          "totalHotelTaxes",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalPlatformFee = 'NaN' THEN 0 ELSE cancelledFlight.totalPlatformFee END), 0)",
          "totalPlatformFee",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalPrice = 'NaN' THEN 0 ELSE cancelledFlight.totalPrice END), 0)",
          "totalPrice",
        )
        .addSelect(
          "COALESCE(SUM(CASE WHEN cancelledFlight.totalEarnings = 'NaN' THEN 0 ELSE cancelledFlight.totalEarnings END), 0)",
          "totalEarnings",
        )
        .getRawOne<Record<string, string>>(),
    ]);

    return {
      totalOngoingCancelledFlights: Number(
        ongoingRaw?.totalOngoingCancelledFlights ?? 0,
      ),
      totalCancelledFlights: Number(finalizedRaw?.totalCancelledFlights ?? 0),
      totalChildren: Number(finalizedRaw?.totalChildren ?? 0),
      totalAdults: Number(finalizedRaw?.totalAdults ?? 0),
      totalBookings: Number(finalizedRaw?.totalBookings ?? 0),
      totalRooms: Number(finalizedRaw?.totalRooms ?? 0),
      totalActualPrice: Number(finalizedRaw?.totalActualPrice ?? 0),
      totalBuyingPrice: Number(finalizedRaw?.totalBuyingPrice ?? 0),
      totalSellingPrice: Number(finalizedRaw?.totalSellingPrice ?? 0),
      totalDiscounts: Number(finalizedRaw?.totalDiscounts ?? 0),
      totalHotelTaxes: Number(finalizedRaw?.totalHotelTaxes ?? 0),
      totalPlatformFee: Number(finalizedRaw?.totalPlatformFee ?? 0),
      totalPrice: Number(finalizedRaw?.totalPrice ?? 0),
      totalEarnings: Number(finalizedRaw?.totalEarnings ?? 0),
    };
  }
}
