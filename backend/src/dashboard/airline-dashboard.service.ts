import { BadRequestException, Injectable } from "@nestjs/common";
import { Logger } from "winston";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-request.interface";
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
import { GetAirlineTrendQueryDto } from "./dto/get-airline-trend-query.dto";
import {
  buildTrendWindow,
  describeTimeFrameRange,
  fillTrendBuckets,
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
    query: GetAirlineTrendQueryDto,
    requestLogger: Logger,
  ): Promise<HotelSpendTrendResponseDto> {
    const { window, points } = await this.getTrend(
      user,
      query,
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
    query: GetAirlineTrendQueryDto,
    requestLogger: Logger,
  ): Promise<AffectedPassengersTrendResponseDto> {
    const { window, points } = await this.getTrend(
      user,
      query,
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
    query: GetAirlineTrendQueryDto,
    requestLogger: Logger,
  ): Promise<CancelledFlightsTrendResponseDto> {
    const { window, points } = await this.getTrend(
      user,
      query,
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
  // window in the request timezone, run one grouped query, zero-fill.
  private async getTrend(
    user: AuthenticatedUser,
    { timeFrame, timezone }: GetAirlineTrendQueryDto,
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

    const trendWindow = buildTrendWindow(timeFrame, timezone);

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
        ...describeTimeFrameRange(timeFrame, trendWindow),
        granularity: trendWindow.granularity,
      },
      points: fillTrendBuckets(
        trendWindow.buckets,
        values,
        trendWindow.granularity,
      ),
    };
  }
}
