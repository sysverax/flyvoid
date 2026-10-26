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
  GetHotelBookingsSummaryQueryDto,
  HotelBookingDetailResponseDto,
  HotelBookingListResponseDto,
  HotelBookingAdminListResponseDto,
  HotelBookingsSummaryResponseDto,
  HotelBookingsAdminSummaryResponseDto,
  SendHotelBookingEmailResponseDto,
} from "./dto";
import { Logger } from "winston";

@ApiTags("Hotel Bookings")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
@Controller("hotel-bookings")
@ApiExtraModels(
  HotelBookingListResponseDto,
  HotelBookingAdminListResponseDto,
  HotelBookingDetailResponseDto,
  HotelBookingsSummaryResponseDto,
  HotelBookingsAdminSummaryResponseDto,
)
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
      asset: [AirlineAsset.CANCELLED_FLIGHTS, AirlineAsset.BOOKINGS],
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "List hotel bookings",
    description:
      "Returns paginated hotel bookings with optional filters: destinationAirportId, cancelledFlightId, startDate/endDate (hotel booking creation time; ISO 8601 timestamps with timezone, start inclusive, end exclusive). Airline users only see their own airline's bookings; search matches hotel booking id, flight number, hotel name or passenger email; providerId and status are ignored. Platform users get HotelBookingAdminListResponseDto (airline, provider, destination airport, hotel id/name, passengers, rooms, full pricing incl. buyingPrice, supplierMargin and totalEarning) and can also filter by airlineId, providerId and status (confirmed, in_progress, manual_check); their search matches hotel booking id or hotel name.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: {
          oneOf: [
            { $ref: getSchemaPath(HotelBookingListResponseDto) },
            { $ref: getSchemaPath(HotelBookingAdminListResponseDto) },
          ],
        },
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
  ): Promise<
    BaseResponseDto<HotelBookingListResponseDto | HotelBookingAdminListResponseDto>
  > {
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

  // ── GET /hotel-bookings/summary ───────────────────────────────────────────
  // Registered before ":id" so "summary" isn't swallowed by the :id route.
  @Get("summary")
  @RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
    airline: {
      asset: [AirlineAsset.BOOKINGS, AirlineAsset.DASHBOARD],
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get hotel bookings summary",
    description:
      "Returns totals for the authenticated airline's live hotel bookings (the same rows as the hotel bookings list): totalBookings, totalPassengers, totalRooms, totalCost, totalPlatformFee. Also returns totalPnrs (all PNRs on the airline's cancelled flights) and totalAllocatedPnrs (PNRs on flights that are allocated, paid or published). Optional filters: destinationAirportId, cancelledFlightId, search, startDate/endDate (hotel booking creation time; ISO 8601 timestamps with timezone, start inclusive, end exclusive). destinationAirportId and cancelledFlightId apply to every total; search and startDate/endDate only narrow the hotel booking totals, not the PNR counts. Airline users need VIEW access on the Bookings tab. Platform users (VIEW on CANCELLED_FLIGHTS) get HotelBookingsAdminSummaryResponseDto instead: totals of CONFIRMED hotel bookings only (totalBookings, totalPassengers, totalRooms, totalCost, totalPlatformFee, totalSupplierMargin, totalDiscounts, totalEarnings, totalPaidToHotels), filtered like the admin list by airlineId, providerId, search (hotel booking id or hotel name) and startDate/endDate; status is accepted but not applied.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: {
          oneOf: [
            { $ref: getSchemaPath(HotelBookingsSummaryResponseDto) },
            { $ref: getSchemaPath(HotelBookingsAdminSummaryResponseDto) },
          ],
        },
      },
    },
  })
  async getHotelBookingsSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetHotelBookingsSummaryQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<
    BaseResponseDto<
      HotelBookingsSummaryResponseDto | HotelBookingsAdminSummaryResponseDto
    >
  > {
    const data = await this.service.getHotelBookingsSummary(
      req.user,
      query,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel bookings summary fetched successfully",
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
      asset: [AirlineAsset.CANCELLED_FLIGHTS, AirlineAsset.BOOKINGS],
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

  // ── GET /hotel-bookings/:id/confirmation ─────────────────────────────────
  @Get(":id/confirmation")
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EXPORT],
    },
    airline: {
      asset: [AirlineAsset.CANCELLED_FLIGHTS, AirlineAsset.BOOKINGS],
      access: [AccessAction.EXPORT],
    },
  })
  @ApiOperation({
    summary: "Download the hotel booking confirmation as a PDF",
    description:
      "Generates a PDF confirmation/voucher for a single hotel booking, for the passenger to present at hotel check-in. States clearly that the stay is fully prepaid and no payment is due. Only available once the flight's status is 'paid' or 'published'.",
  })
  @ApiParam({ name: "id", description: "Hotel booking id" })
  @ApiProduces("application/pdf")
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/hotel-bookings/:id/confirmation",
      "Hotel booking not found",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      "/api/v1/hotel-bookings/:id/confirmation",
    ),
  })
  async downloadBookingConfirmation(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @RequestLogger() requestLogger: Logger,
    @Res() res: Response,
  ): Promise<void> {
    const { fileName, pdf } = await this.service.generateBookingConfirmationPdf(
      id,
      req.user,
      requestLogger,
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
    res.send(pdf);
  }

  // ── POST /hotel-bookings/:id/send ────────────────────────────────────────
  @Post(":id/send")
  @RequireUserTypes(UserType.AIRLINE)
  @RequireAccessControl({
    airline: {
      asset: [AirlineAsset.CANCELLED_FLIGHTS, AirlineAsset.BOOKINGS],
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
