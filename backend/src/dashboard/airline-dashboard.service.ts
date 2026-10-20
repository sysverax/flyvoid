import { BadRequestException, Injectable } from "@nestjs/common";
import { Logger } from "winston";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-request.interface";
import { TimeFrame } from "../common/constants/time-frame.constants";
import {
  AirlineDashboardRepository,
  TREND_METRICS,
  TrendMetric,
} from "./airline-dashboard.repository";
import {
  AffectedPassengersTrendResponseDto,
  AirlineTrendResponseDto,
  CancelledFlightsTrendResponseDto,
  HotelSpendTrendResponseDto,
} from "./dto/airline-trend-response.dto";
import {
  buildTrendWindow,
  fillTrendBuckets,
  formatInTimeZone,
  TrendPoint,
} from "../common/utils/time-frame.util";

@Injectable()
export class AirlineDashboardService {
  private readonly context = "AirlineDashboardService";

  constructor(
    private readonly airlineDashboardRepository: AirlineDashboardRepository,
  ) {}

  async getHotelSpendTrend(
    user: AuthenticatedUser,
    timeFrame: TimeFrame,
    requestLogger: Logger,
  ): Promise<HotelSpendTrendResponseDto> {
    const { window, points } = await this.getTrend(
      user,
      timeFrame,
      TREND_METRICS.hotelSpend,
      requestLogger,
    );
    return {
      ...window,
      points: points.map(({ bucket, label, value }) => ({
        bucket,
        label,
        spend: value,
      })),
    };
  }

  async getAffectedPassengersTrend(
    user: AuthenticatedUser,
    timeFrame: TimeFrame,
    requestLogger: Logger,
  ): Promise<AffectedPassengersTrendResponseDto> {
    const { window, points } = await this.getTrend(
      user,
      timeFrame,
      TREND_METRICS.affectedPassengers,
      requestLogger,
    );
    return {
      ...window,
      points: points.map(({ bucket, label, value }) => ({
        bucket,
        label,
        passengers: value,
      })),
    };
  }

  async getCancelledFlightsTrend(
    user: AuthenticatedUser,
    timeFrame: TimeFrame,
    requestLogger: Logger,
  ): Promise<CancelledFlightsTrendResponseDto> {
    const { window, points } = await this.getTrend(
      user,
      timeFrame,
      TREND_METRICS.cancelledFlights,
      requestLogger,
    );
    return {
      ...window,
      points: points.map(({ bucket, label, value }) => ({
        bucket,
        label,
        flights: value,
      })),
    };
  }

  // Shared by all three trends: scope to the caller's airline, resolve the
  // window in the airline's timezone, run one grouped query, zero-fill.
  private async getTrend(
    user: AuthenticatedUser,
    timeFrame: TimeFrame,
    metric: TrendMetric,
    requestLogger: Logger,
  ): Promise<{ window: AirlineTrendResponseDto; points: TrendPoint[] }> {
    const airlineId = user.airlineId;

    if (!airlineId) {
      requestLogger.error(
        "Authenticated airline user does not have an associated airlineId",
        { context: this.context, userId: user.sub },
      );
      throw new BadRequestException(
        "Authenticated airline user does not have an associated airlineId",
      );
    }

    const trendWindow = buildTrendWindow(timeFrame, user.airlineTimezone);

    if (trendWindow.timeZone !== user.airlineTimezone) {
      requestLogger.warn(
        "Airline timezone missing, invalid or non-canonical; using resolved timezone for dashboard trend",
        {
          context: this.context,
          airlineId,
          airlineTimezone: user.airlineTimezone,
          resolvedTimezone: trendWindow.timeZone,
        },
      );
    }

    requestLogger.info("Fetching airline dashboard trend", {
      context: this.context,
      airlineId,
      timeFrame,
      granularity: trendWindow.granularity,
      timezone: trendWindow.timeZone,
    });

    const values = await this.airlineDashboardRepository.getTrend(
      {
        airlineId,
        metric,
        granularity: trendWindow.granularity,
        timeZone: trendWindow.timeZone,
        startUtc: trendWindow.startUtc,
        endUtc: trendWindow.endUtc,
      },
      requestLogger,
    );

    return {
      window: {
        timeFrame,
        granularity: trendWindow.granularity,
        timezone: trendWindow.timeZone,
        startDate: formatInTimeZone(trendWindow.startUtc, trendWindow.timeZone),
        // endUtc is exclusive; report the last second inside the window.
        endDate: formatInTimeZone(
          new Date(trendWindow.endUtc.getTime() - 1000),
          trendWindow.timeZone,
        ),
      },
      points: fillTrendBuckets(
        trendWindow.buckets,
        values,
        trendWindow.granularity,
      ),
    };
  }
}
