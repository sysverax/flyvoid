import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Logger } from "winston";
import {
  RAISED_FLIGHT_STATUSES,
  REPORTING_DATE_COLUMN,
  SPEND_FLIGHT_STATUSES,
  toUtcTimestampParam,
} from "../cancelled-flights/cancelled-flight-reporting.constants";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";
import { FlightStatus } from "../cancelled-flights/entities/enums";
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

export interface TrendMetric {
  /** Aggregate SQL over the `flight` alias, returned as `value`. */
  valueExpression: string;
  statuses: FlightStatus[];
}

// Postgres numeric can hold NaN, which SUM() propagates and COALESCE
// doesn't catch - treat a poisoned row as 0 (same guard as the summary).
const sumIgnoringNaN = (column: string) =>
  `COALESCE(SUM(CASE WHEN ${column} = 'NaN' THEN 0 ELSE ${column} END), 0)`;

export const TREND_METRICS = {
  hotelSpend: {
    valueExpression: sumIgnoringNaN("flight.totalPrice"),
    statuses: SPEND_FLIGHT_STATUSES,
  },
  affectedPassengers: {
    valueExpression:
      "COALESCE(SUM(flight.totalAdults + flight.totalChildren), 0)",
    statuses: RAISED_FLIGHT_STATUSES,
  },
  cancelledFlights: {
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
  ) {}

  /**
   * Aggregates one metric per bucket in a single grouped query. Buckets are
   * computed in the airline's timezone; buckets without rows are absent from
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

    // granularity and the key format come from fixed maps, never from input.
    const localBucketStart = `date_trunc('${granularity}', (${REPORTING_DATE_COLUMN} AT TIME ZONE 'UTC') AT TIME ZONE :timeZone)`;

    const rows = await this.flightRepo
      .createQueryBuilder("flight")
      .select(
        `to_char(${localBucketStart}, '${BUCKET_KEY_FORMAT[granularity]}')`,
        "bucket",
      )
      .addSelect(metric.valueExpression, "value")
      .where("flight.airlineId = :airlineId", { airlineId })
      .andWhere("flight.status IN (:...statuses)", {
        statuses: metric.statuses,
      })
      .andWhere(`${REPORTING_DATE_COLUMN} >= :startUtc`, {
        startUtc: toUtcTimestampParam(startUtc),
      })
      .andWhere(`${REPORTING_DATE_COLUMN} < :endUtc`, {
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
    return new Map(
      rows.map((row) => {
        const value = Number(row.value ?? 0);
        return [row.bucket, Number.isFinite(value) ? value : 0];
      }),
    );
  }
}
