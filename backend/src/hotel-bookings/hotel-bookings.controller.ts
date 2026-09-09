import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  getSchemaPath,
  ApiExtraModels,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../auth/guards/rbac.guard";
import {
  RequireAccessControl,
  RequireUserTypes,
} from "../auth/decorators/rbac.decorator";
import {
  AccessAction,
  AirlineAsset,
  PlatformAsset,
} from "../common/constants/access-control.constants";
import { UserType } from "../common/constants/user.constants";
import { BaseResponseDto } from "../common/dto/base-response.dto";
import { RequestId } from "../common/decorators/request-id.decorator";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import {
  createBadRequestErrorSchema,
  createNotFoundErrorSchema,
} from "../common/constants/swagger.constants";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { HotelBookingsService } from "./hotel-bookings.service";
import {
  GetHotelBookingsQueryDto,
  HotelBookingDetailResponseDto,
  HotelBookingListResponseDto,
  SendHotelBookingEmailResponseDto,
} from "./dto";
import { Logger } from "winston";

@ApiTags("Hotel Bookings")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
@Controller("hotel-bookings")
@ApiExtraModels(HotelBookingListResponseDto, HotelBookingDetailResponseDto)
export class HotelBookingsController {
  constructor(private readonly service: HotelBookingsService) {}

  // ── GET /hotel-bookings ──────────────────────────────────────────────────
  @Get("/")
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "List hotel bookings",
    description:
      "Returns paginated hotel bookings with optional filters: destinationAirportId, cancelledFlightId, search (hotel booking id, flight number, hotel name, or passenger email), startDate/endDate (check-in date range). Platform users can filter by airlineId; airline users only see their own airline's hotel bookings.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(HotelBookingListResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/hotel-bookings"),
  })
  async listHotelBookings(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetHotelBookingsQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<HotelBookingListResponseDto>> {
    const data = await this.service.listHotelBookings(
      req.user,
      query,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel bookings fetched successfully",
    );
  }

  // ── GET /hotel-bookings/:id ──────────────────────────────────────────────
  @Get(":id")
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get hotel booking details",
    description:
      "Returns the flight, passenger booking, and hotel details for a single hotel booking.",
  })
  @ApiParam({ name: "id", description: "Hotel booking id" })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(HotelBookingDetailResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/hotel-bookings/:id",
      "Hotel booking not found",
    ),
  })
  async getHotelBookingDetail(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<HotelBookingDetailResponseDto>> {
    const data = await this.service.getHotelBookingDetail(
      id,
      req.user,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel booking details fetched successfully",
    );
  }

  // ── GET /hotel-bookings/:id/export ───────────────────────────────────────
  @Get(":id/export")
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EXPORT],
    },
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EXPORT],
    },
  })
  @ApiOperation({
    summary: "Export a hotel booking as CSV",
    description:
      "Downloads the flight, passenger booking, and hotel details for a single hotel booking as a CSV file.",
  })
  @ApiParam({ name: "id", description: "Hotel booking id" })
  @ApiProduces("text/csv")
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/hotel-bookings/:id/export",
      "Hotel booking not found",
    ),
  })
  async exportHotelBooking(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @RequestLogger() requestLogger: Logger,
    @Res() res: Response,
  ): Promise<void> {
    const { fileName, csv } = await this.service.exportHotelBooking(
      id,
      req.user,
      requestLogger,
    );

    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
    res.send(csv);
  }

  // ── POST /hotel-bookings/:id/send ────────────────────────────────────────
  @Post(":id/send")
  @RequireUserTypes(UserType.AIRLINE)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Send the hotel booking confirmation email to the passenger",
    description:
      "Sends the hotel booking confirmation email to the passenger. Only available to airline users, and only once the cancelled flight's status is 'paid' or 'published'.",
  })
  @ApiParam({ name: "id", description: "Hotel booking id" })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(SendHotelBookingEmailResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/hotel-bookings/:id/send",
      "Hotel booking not found",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/hotel-bookings/:id/send"),
  })
  async sendHotelBookingEmail(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<SendHotelBookingEmailResponseDto>> {
    const data = await this.service.sendHotelBookingEmail(
      id,
      req.user,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel booking confirmation email sent",
    );
  }
}
