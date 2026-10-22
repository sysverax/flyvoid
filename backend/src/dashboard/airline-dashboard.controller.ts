import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { Logger } from "winston";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../auth/guards/rbac.guard";
import {
  RequireAccessControl,
  RequireUserTypes,
} from "../auth/decorators/rbac.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import {
  AccessAction,
  AirlineAsset,
} from "../common/constants/access-control.constants";
import { TIME_FRAME } from "../common/constants/time-frame.constants";
import {
  TIME_FRAME_DESCRIPTION,
  TIMEZONE_DESCRIPTION,
  TIMEZONE_EXAMPLE,
} from "../common/dto/time-frame-query.dto";
import { UserType } from "../common/constants/user.constants";
import {
  REQUEST_ID_EXAMPLE,
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createForbiddenErrorSchema,
  createUnauthorizedErrorSchema,
} from "../common/constants/swagger.constants";
import { RequestId } from "../common/decorators/request-id.decorator";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import { BaseResponseDto } from "../common/dto/base-response.dto";
import { AirlineDashboardService } from "./airline-dashboard.service";
import {
  AffectedPassengersTrendResponseDto,
  CancelledFlightsTrendResponseDto,
  HotelSpendTrendResponseDto,
} from "./dto/airline-trend-response.dto";
import { GetAirlineTrendQueryDto } from "./dto/get-airline-trend-query.dto";

const BASE_PATH = "/api/v1/dashboard/airline";

const TIME_FRAME_QUERY = {
  name: "timeFrame",
  required: true,
  enum: TIME_FRAME,
  description: TIME_FRAME_DESCRIPTION,
};

const TIMEZONE_QUERY = {
  name: "timezone",
  required: true,
  example: TIMEZONE_EXAMPLE,
  description: TIMEZONE_DESCRIPTION,
};

const successSchema = (message: string, dto: object) => ({
  schema: {
    properties: {
      success: { type: "boolean", example: true },
      requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
      timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
      message: { type: "string", example: message },
      data: { $ref: getSchemaPath(dto as never) },
    },
  },
});

@ApiTags("Airline Dashboard")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.AIRLINE)
@RequireAccessControl({
  airline: { asset: AirlineAsset.DASHBOARD, access: [AccessAction.VIEW] },
})
@Controller("dashboard/airline")
@ApiExtraModels(
  HotelSpendTrendResponseDto,
  AffectedPassengersTrendResponseDto,
  CancelledFlightsTrendResponseDto,
)
export class AirlineDashboardController {
  constructor(private readonly service: AirlineDashboardService) {}

  // ── GET /dashboard/airline/hotel-spend-trend ─────────────────────────────
  @Get("hotel-spend-trend")
  @ApiOperation({
    summary: "Get hotel spend trend",
    description:
      "Total hotel cost (including tax and platform fee) per bucket for the authenticated airline's allocated, paid and published cancelled flights. Always scoped to the caller's airline. The range and buckets use the `timezone` query parameter (required); missing, invalid or raw-offset timezones return 400.",
  })
  @ApiQuery(TIME_FRAME_QUERY)
  @ApiQuery(TIMEZONE_QUERY)
  @ApiOkResponse(
    successSchema(
      "Hotel spend trend fetched successfully",
      HotelSpendTrendResponseDto,
    ),
  )
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(`${BASE_PATH}/hotel-spend-trend`),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      `${BASE_PATH}/hotel-spend-trend`,
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      `${BASE_PATH}/hotel-spend-trend`,
      "Access denied",
    ),
  })
  async getHotelSpendTrend(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetAirlineTrendQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<HotelSpendTrendResponseDto>> {
    const data = await this.service.getHotelSpendTrend(
      req.user,
      query,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel spend trend fetched successfully",
    );
  }

  // ── GET /dashboard/airline/affected-passengers-trend ─────────────────────
  @Get("affected-passengers-trend")
  @ApiOperation({
    summary: "Get affected passengers trend",
    description:
      "Adults plus children per bucket across the authenticated airline's non-draft cancelled flights. Always scoped to the caller's airline. The range and buckets use the `timezone` query parameter (required); missing, invalid or raw-offset timezones return 400.",
  })
  @ApiQuery(TIME_FRAME_QUERY)
  @ApiQuery(TIMEZONE_QUERY)
  @ApiOkResponse(
    successSchema(
      "Affected passengers trend fetched successfully",
      AffectedPassengersTrendResponseDto,
    ),
  )
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      `${BASE_PATH}/affected-passengers-trend`,
    ),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      `${BASE_PATH}/affected-passengers-trend`,
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      `${BASE_PATH}/affected-passengers-trend`,
      "Access denied",
    ),
  })
  async getAffectedPassengersTrend(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetAirlineTrendQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<AffectedPassengersTrendResponseDto>> {
    const data = await this.service.getAffectedPassengersTrend(
      req.user,
      query,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Affected passengers trend fetched successfully",
    );
  }

  // ── GET /dashboard/airline/cancelled-flights-trend ───────────────────────
  @Get("cancelled-flights-trend")
  @ApiOperation({
    summary: "Get cancelled flights trend",
    description:
      "Number of non-draft cancelled flights per bucket for the authenticated airline. Always scoped to the caller's airline. The range and buckets use the `timezone` query parameter (required); missing, invalid or raw-offset timezones return 400.",
  })
  @ApiQuery(TIME_FRAME_QUERY)
  @ApiQuery(TIMEZONE_QUERY)
  @ApiOkResponse(
    successSchema(
      "Cancelled flights trend fetched successfully",
      CancelledFlightsTrendResponseDto,
    ),
  )
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(`${BASE_PATH}/cancelled-flights-trend`),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      `${BASE_PATH}/cancelled-flights-trend`,
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      `${BASE_PATH}/cancelled-flights-trend`,
      "Access denied",
    ),
  })
  async getCancelledFlightsTrend(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetAirlineTrendQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<CancelledFlightsTrendResponseDto>> {
    const data = await this.service.getCancelledFlightsTrend(
      req.user,
      query,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Cancelled flights trend fetched successfully",
    );
  }
}
