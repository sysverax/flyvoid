import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import { Logger } from "winston";
import {
  RAISED_FLIGHT_STATUSES,
  REPORTING_DATE_COLUMN,
  SPEND_FLIGHT_STATUSES,
  toUtcTimestampParam,
} from "../cancelled-flights/cancelled-flight-reporting.constants";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";
import { FlightStatus } from "../cancelled-flights/entities/enums";
import { HotelBookingEntity } from "../cancelled-flights/entities/hotel-booking.entity";
import { BookingEntity } from "../cancelled-flights/entities/booking.entity";
import { LIVE_HOTEL_BOOKING_CONDITION } from "../cancelled-flights/hotel-allocation.record";
import {
  TREND_GRANULARITY,
  TrendGranularity,
} from "../common/constants/time-frame.constants";

// Postgres to_char patterns producing the same keys as toBucketKey().
const BUCKET_KEY_FORMAT: Record<TrendGranularity, string> = {
  [TREND_GRANULARITY.HOUR]: 'YYYY-MM-DD"T"HH24":00"',
  [TREND_GRANULARITY.DAY]: "YYYY-MM-DD",
  [TREND_GRANULARITY.MONTH]: "YYYY-MM",
  [TREND_GRANULARITY.YEAR]: "YYYY",
};

/** Hotel booking timestamp that places a booking in a reporting period. */
const HOTEL_BOOKING_DATE_COLUMN = "hotelBooking.createdAt";

/** PNR timestamp that places a passenger booking in a reporting period. */
const PNR_DATE_COLUMN = "booking.createdAt";

export interface TrendMetric {
  /**
   * Rows that are bucketed: cancelled flights by the flight's created_at,
   * PNRs by the PNR's created_at, or live hotel bookings by the hotel
   * booking's created_at.
   */
  source: "flight" | "pnr" | "hotelBooking";
  /** Aggregate SQL over the `flight` (and `booking` / `hotelBooking`) alias, returned as `value`. */
  valueExpression: string;
  /** Flight statuses included. */
  statuses: FlightStatus[];
}

export interface AirlineDashboardTotals {
  totalHotelBookingCost: number;
  totalHotelBookings: number;
  totalRooms: number;
  totalPlatformFee: number;
  totalCancelFlights: number;
  totalAdults: number;
  totalChildren: number;
}

// Postgres numeric can hold NaN, which SUM() propagates and COALESCE
// doesn't catch - treat a poisoned row as 0 (same guard as the summary).
const sumIgnoringNaN = (column: string) =>
  `COALESCE(SUM(CASE WHEN ${column} = 'NaN' THEN 0 ELSE ${column} END), 0)`;

export const TREND_METRICS = {
  // Same rows as the summary's totalHotelBookingCost, so the chart total
  // always equals the cost card.
  hotelSpend: {
    source: "hotelBooking",
    valueExpression: sumIgnoringNaN("hotelBooking.totalPrice"),
    statuses: SPEND_FLIGHT_STATUSES,
  },
  // Adults + children per PNR, bucketed by when the PNR was created.
  affectedPassengers: {
    source: "pnr",
    valueExpression:
      "COALESCE(SUM(booking.adults + booking.children), 0)",
    statuses: RAISED_FLIGHT_STATUSES,
  },
  cancelledFlights: {
    source: "flight",
    valueExpression: "COUNT(flight.id)",
    statuses: RAISED_FLIGHT_STATUSES,
  },
} satisfies Record<string, TrendMetric>;

@Injectable()
export class AirlineDashboardRepository {
  private readonly context = "AirlineDashboardRepository";

  constructor(
    @InjectRepository(CancelledFlightEntity)
    private readonly flightRepo: Repository<CancelledFlightEntity>,
    @InjectRepository(HotelBookingEntity)
    private readonly hotelBookingRepo: Repository<HotelBookingEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepo: Repository<BookingEntity>,
  ) {}

  /**
   * Dashboard KPI totals for [startUtc, endUtc).
   * - Hotel totals: live hotel bookings by their own created_at, on
   *   allocated, paid or published flights.
   * - Flight count: non-draft flights by the flight's created_at.
   * - Adults / children: PNRs on non-draft flights by the PNR's created_at
   *   (same rows as the affected passengers trend).
   */
  async getSummary(
    {
      airlineId,
      startUtc,
      endUtc,
    }: { airlineId: number; startUtc: Date; endUtc: Date },
    requestLogger: Logger,
  ): Promise<AirlineDashboardTotals> {
    requestLogger.debug("Querying airline dashboard summary", {
      context: this.context,
      airlineId,
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
    });

    const range = {
      startUtc: toUtcTimestampParam(startUtc),
      endUtc: toUtcTimestampParam(endUtc),
    };

    const liveHotelBookings = () =>
      this.liveHotelBookingsQuery(airlineId)
        .andWhere("flight.status IN (:...spendStatuses)", {
          spendStatuses: SPEND_FLIGHT_STATUSES,
        })
        .andWhere(`${HOTEL_BOOKING_DATE_COLUMN} >= :startUtc`, range)
        .andWhere(`${HOTEL_BOOKING_DATE_COLUMN} < :endUtc`, range);

    const hotelTotalsQuery = liveHotelBookings()
      .select("COUNT(hotelBooking.id)", "totalHotelBookings")
      .addSelect(sumIgnoringNaN("hotelBooking.totalPrice"), "totalHotelBookingCost")
      .addSelect(sumIgnoringNaN("hotelBooking.platformFee"), "totalPlatformFee")
      .getRawOne<{
        totalHotelBookings: string;
        totalHotelBookingCost: string;
        totalPlatformFee: string;
      }>();

    // Separate query: joining rooms above would repeat each booking's price
    // once per room.
    const roomsQuery = liveHotelBookings()
      .innerJoin("hotelBooking.rooms", "room", "room.status <> 'failed'")
      .select("COUNT(room.id)", "totalRooms")
      .getRawOne<{ totalRooms: string }>();

    const flightTotalsQuery = this.flightRepo
      .createQueryBuilder("flight")
      .select("COUNT(flight.id)", "totalCancelFlights")
      .where("flight.airlineId = :airlineId", { airlineId })
      .andWhere("flight.status IN (:...raisedStatuses)", {
        raisedStatuses: RAISED_FLIGHT_STATUSES,
      })
      .andWhere(`${REPORTING_DATE_COLUMN} >= :startUtc`, range)
      .andWhere(`${REPORTING_DATE_COLUMN} < :endUtc`, range)
      .getRawOne<{ totalCancelFlights: string }>();

    const passengerTotalsQuery = this.pnrQuery(airlineId)
      .select("COALESCE(SUM(booking.adults), 0)", "totalAdults")
      .addSelect("COALESCE(SUM(booking.children), 0)", "totalChildren")
      .andWhere("flight.status IN (:...raisedStatuses)", {
        raisedStatuses: RAISED_FLIGHT_STATUSES,
      })
      .andWhere(`${PNR_DATE_COLUMN} >= :startUtc`, range)
      .andWhere(`${PNR_DATE_COLUMN} < :endUtc`, range)
      .getRawOne<{ totalAdults: string; totalChildren: string }>();

    const [hotelTotals, rooms, flightTotals, passengerTotals] =
      await Promise.all([
        hotelTotalsQuery,
        roomsQuery,
        flightTotalsQuery,
        passengerTotalsQuery,
      ]);

    requestLogger.debug("Airline dashboard summary query complete", {
      context: this.context,
    });

    // COUNT/SUM come back from pg as strings; a non-finite value would
    // otherwise serialize to JSON as null.
    const toFiniteNumber = (value: unknown): number => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num : 0;
    };

    return {
      totalHotelBookingCost: toFiniteNumber(hotelTotals?.totalHotelBookingCost),
      totalHotelBookings: toFiniteNumber(hotelTotals?.totalHotelBookings),
      totalRooms: toFiniteNumber(rooms?.totalRooms),
      totalPlatformFee: toFiniteNumber(hotelTotals?.totalPlatformFee),
      totalCancelFlights: toFiniteNumber(flightTotals?.totalCancelFlights),
      totalAdults: toFiniteNumber(passengerTotals?.totalAdults),
      totalChildren: toFiniteNumber(passengerTotals?.totalChildren),
    };
  }

  /**
   * Aggregates one metric per bucket in a single grouped query. Buckets are
   * computed in the request's timezone; buckets without rows are absent from
   * the result and are zero-filled by the caller.
   */
  async getTrend(
    {
      airlineId,
      metric,
      granularity,
      timeZone,
      startUtc,
      endUtc,
    }: {
      airlineId: number;
      metric: TrendMetric;
      granularity: TrendGranularity;
      timeZone: string;
      startUtc: Date;
      endUtc: Date;
    },
    requestLogger: Logger,
  ): Promise<Map<string, number>> {
    requestLogger.debug("Querying airline dashboard trend", {
      context: this.context,
      airlineId,
      granularity,
      timeZone,
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
    });

    const { baseQuery, dateColumn } = this.trendSource(metric, airlineId);

    // granularity and the key format come from fixed maps, never from input.
    const localBucketStart = `date_trunc('${granularity}', (${dateColumn} AT TIME ZONE 'UTC') AT TIME ZONE :timeZone)`;

    const rows = await baseQuery
      .select(
        `to_char(${localBucketStart}, '${BUCKET_KEY_FORMAT[granularity]}')`,
        "bucket",
      )
      .addSelect(metric.valueExpression, "value")
      .andWhere("flight.status IN (:...statuses)", {
        statuses: metric.statuses,
      })
      .andWhere(`${dateColumn} >= :startUtc`, {
        startUtc: toUtcTimestampParam(startUtc),
      })
      .andWhere(`${dateColumn} < :endUtc`, {
        endUtc: toUtcTimestampParam(endUtc),
      })
      .setParameter("timeZone", timeZone)
      .groupBy("bucket")
      .getRawMany<{ bucket: string; value: string | number | null }>();

    requestLogger.debug("Airline dashboard trend query complete", {
      context: this.context,
      bucketsWithData: rows.length,
    });

    // COUNT/SUM come back from pg as strings; a non-finite value would
    // otherwise serialize to JSON as null.
    return new Map<string, number>(
      rows.map((row) => {
        const value = Number(row.value ?? 0);
        return [row.bucket, Number.isFinite(value) ? value : 0];
      }),
    );
  }

  /** Rows to bucket for a trend metric, scoped to the airline (always joins `flight`). */
  private trendSource(
    metric: TrendMetric,
    airlineId: number,
  ): { baseQuery: SelectQueryBuilder<ObjectLiteral>; dateColumn: string } {
    switch (metric.source) {
      case "hotelBooking":
        return {
          baseQuery: this.liveHotelBookingsQuery(airlineId),
          dateColumn: HOTEL_BOOKING_DATE_COLUMN,
        };
      case "pnr":
        return {
          baseQuery: this.pnrQuery(airlineId),
          dateColumn: PNR_DATE_COLUMN,
        };
      case "flight":
        return {
          baseQuery: this.flightRepo
            .createQueryBuilder("flight")
            .where("flight.airlineId = :airlineId", { airlineId }),
          dateColumn: REPORTING_DATE_COLUMN,
        };
    }
  }

  /** The airline's PNRs (passenger bookings). Aliases: `booking`, `flight`. */
  private pnrQuery(airlineId: number): SelectQueryBuilder<BookingEntity> {
    return this.bookingRepo
      .createQueryBuilder("booking")
      .innerJoin("booking.cancelledFlight", "flight")
      .where("flight.airlineId = :airlineId", { airlineId });
  }

  /**
   * The airline's live hotel bookings - the same rows as the hotel bookings
   * list. Aliases: `hotelBooking`, `booking`, `flight`.
   */
  private liveHotelBookingsQuery(
    airlineId: number,
  ): SelectQueryBuilder<HotelBookingEntity> {
    return this.hotelBookingRepo
      .createQueryBuilder("hotelBooking")
      .innerJoin("hotelBooking.booking", "booking")
      .innerJoin("hotelBooking.cancelledFlight", "flight")
      .where(LIVE_HOTEL_BOOKING_CONDITION)
      .andWhere("flight.airlineId = :airlineId", { airlineId });
  }
}
