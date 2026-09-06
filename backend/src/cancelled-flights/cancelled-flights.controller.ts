import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
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
import {
  REQUEST_ID_EXAMPLE,
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createConflictErrorSchema,
  createNotFoundErrorSchema,
  createUnauthorizedErrorSchema,
} from "../common/constants/swagger.constants";
import { CancelledFlightsService } from "./cancelled-flights.service";
import {
  CreateCancelledFlightDto,
  CancelledFlightResponseDto,
  UpdateCancelledFlightDto,
  CreateBookingDto,
  BookingResponseDto,
  CancelledFlightListResponseDto,
  ImportBookingResponseDto,
  UpdateBookingDto,
  ReviewCancelledFlightResponseDto,
  AllocateHotelDto,
  CheckRateRequestDto,
  BookHotelRequestDto,
} from "./dto";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import { Logger } from "winston";
import { GetCancelledFlightsQueryDto } from "./dto/get-cancelled-flights-query.dto";
import { HotelAllocationsDto } from "./dto/hotel-allocations.dto";

@ApiTags("Cancelled Flights")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.AIRLINE)
@Controller("cancelled-flights")
@ApiExtraModels(
  CancelledFlightResponseDto,
  BookingResponseDto,
  CancelledFlightListResponseDto,
  ImportBookingResponseDto,
  HotelAllocationsDto,
)
export class CancelledFlightsController {
  constructor(private readonly service: CancelledFlightsService) {}

  // ── GET /cancelled-flights ───────────────────────────────────────────────

  @Get("/")
  @RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
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
    summary: "List cancelled flights",
    description:
      "Returns paginated cancelled flights with optional filters: status, search, airlineId, startDate, endDate. Platform users can view all airlines and can filter by airlineId; airline users only see flights for their own airline.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
        timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
        message: {
          type: "string",
          example: "Cancelled flights fetched successfully",
        },
        data: { $ref: "#/components/schemas/CancelledFlightListResponseDto" },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/cancelled-flights"),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/cancelled-flights",
      "Unauthorized",
    ),
  })
  async listCancelledFlights(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetCancelledFlightsQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<CancelledFlightListResponseDto>> {
    requestLogger.info("Listing cancelled flights", {
      query,
      user: req.user,
    });
    const data = await this.service.listCancelledFlights(
      req.user,
      query,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Cancelled flights fetched successfully",
    );
  }

  // ── POST /cancelled-flights ──────────────────────────────────────────────

  @Post("/")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Create a cancelled flight record",
    description:
      "Creates a new cancelled flight with status = draft. Departure and arrival airports must differ.",
  })
  @ApiCreatedResponse({
    schema: {
      allOf: [
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Cancelled flight created" },
            data: {
              $ref: "#/components/schemas/CancelledFlightResponseDto",
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/cancelled-flights"),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/cancelled-flights",
      "Unauthorized",
    ),
  })
  async createCancelledFlight(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCancelledFlightDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<CancelledFlightResponseDto>> {
    const user = req.user;
    const airlineId = user.airlineId;
    if (!airlineId) {
      throw new BadRequestException(
        "Authenticated user does not have an associated airlineId",
      );
    }
    const data = await this.service.createCancelledFlight(
      airlineId,
      dto,
      requestId,
    );
    return BaseResponseDto.success(data, requestId, "Cancelled flight created");
  }

  // ── PATCH /cancelled-flights/:id ─────────────────────────────────────────

  @Patch(":id")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Update a cancelled flight record",
    description:
      "Partially updates a cancelled flight. Departure and arrival airports must differ if both are set.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id",
      "Cancelled flight not found",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/cancelled-flights/:id"),
  })
  async updateCancelledFlight(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCancelledFlightDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<CancelledFlightResponseDto>> {
    const airlineId = req.user.airlineId;
    if (!airlineId) {
      throw new BadRequestException(
        "Authenticated user does not have an associated airlineId",
      );
    }

    const data = await this.service.updateCancelledFlight(
      id,
      airlineId,
      dto,
      requestId,
    );

    return BaseResponseDto.success(data, requestId, "Cancelled flight updated");
  }

  // ── POST /cancelled-flights/:id/bookings ────────────────────────────────

  @Post(":id/bookings")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Add a booking to a cancelled flight",
    description:
      "Manually adds a single booking. PNR must be unique per flight.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiCreatedResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
        timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
        message: { type: "string", example: "Booking added" },
        data: { $ref: "#/components/schemas/BookingResponseDto" },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings",
      "Cancelled flight not found",
    ),
  })
  @ApiConflictResponse({
    schema: createConflictErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings",
      "PNR already exists",
    ),
  })
  async addBooking(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateBookingDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<BookingResponseDto>> {
    const data = await this.service.addBooking(id, dto, requestId);
    return BaseResponseDto.success(data, requestId, "Booking added");
  }

  // ── POST /cancelled-flights/:id/bookings/import ─────────────────────────
  @Post(":id/bookings/import")
  @HttpCode(HttpStatus.OK)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({
    summary: "Import bookings from a CSV file",
    description:
      "Parses a .csv file and imports bookings for the cancelled flight.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
        timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
        message: { type: "string", example: "Bookings imported successfully" },
        data: { $ref: "#/components/schemas/ImportBookingResponseDto" },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/import",
    ),
  })
  async importBookings(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<ImportBookingResponseDto>> {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const ext = file.originalname?.split(".").pop()?.toLowerCase();
    const allowedMimes = ["text/csv", "application/csv"];
    if (ext !== "csv" && !allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("Only .csv files are accepted");
    }
    const data = await this.service.importBookings(id, file, requestId);
    return BaseResponseDto.success(
      data,
      requestId,
      "Bookings imported successfully",
    );
  }

  // ── PUT /cancelled-flights/:id/bookings/:bookingId ───────────────────────
  @Patch(":id/bookings/:bookingId")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Update an existing booking",
    description:
      "All fields are optional. If PNR changes, uniqueness per flight is re-validated.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiParam({ name: "bookingId", description: "Booking id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/:bookingId",
      "Booking not found",
    ),
  })
  @ApiConflictResponse({
    schema: createConflictErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/:bookingId",
      "PNR conflict",
    ),
  })
  async updateBooking(
    @Param("id", ParseIntPipe) id: number,
    @Param("bookingId", ParseIntPipe) bookingId: number,
    @Body() dto: UpdateBookingDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.updateBooking(
      id,
      bookingId,
      dto,
      requestId,
    );
    return BaseResponseDto.success(data, requestId, "Booking updated");
  }

  // ── DELETE /cancelled-flights/:id/bookings/:bookingId ───────────────────

  @Delete(":id/bookings/:bookingId")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW, AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Delete a booking",
    description: "Hard deletes a booking by ID. Flight and booking must exist.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiParam({ name: "bookingId", description: "Booking id" })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Booking deleted successfully",
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/:bookingId",
      "Booking not found",
    ),
  })
  async deleteBooking(
    @Param("id", ParseIntPipe) id: number,
    @Param("bookingId", ParseIntPipe) bookingId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.deleteBooking(id, bookingId, requestId);
    return BaseResponseDto.success(data, requestId);
  }

  // ── GET /cancelled-flights/:id/bookings ──────────────────────────────────

  @Get(":id/bookings")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "List all bookings for a cancelled flight",
    description:
      "Returns summary counts and the full booking list for a flight.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings",
      "Cancelled flight not found",
    ),
  })
  async listBookings(
    @Param("id", ParseIntPipe) id: number,
    @Query() pagination: PaginationQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.listBookings(id, pagination, requestId);
    return BaseResponseDto.success(
      data,
      requestId,
      "Bookings fetched successfully",
    );
  }

  // ── GET /cancelled-flights/:id/review ───────────────────────────────────

  @Get(":id/review")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Review a cancelled flight before hotel allocation",
    description: "Returns full flight details with route, and summary counts.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/review",
      "Cancelled flight not found",
    ),
  })
  async reviewFlight(
    @Param("id", ParseIntPipe) id: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<ReviewCancelledFlightResponseDto>> {
    const data = await this.service.reviewFlight(id, requestId);
    return BaseResponseDto.success(
      data,
      requestId,
      "Flight review fetched successfully",
    );
  }

  // POST /cancelled-flights/:id/bookings/confirm
  // Confirm the passenger booking details and move the flight status to PASSENGERS_BOOKING_CONFIRMED
  @Post(":id/bookings/confirm")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Confirm passenger booking details",
    description:
      "Confirms that all passenger booking details are correct and moves the flight status to PASSENGERS_BOOKING_CONFIRMED.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/confirm",
      "Cancelled flight not found",
    ),
  })
  async confirmPassengerBookingDetails(
    @Param("id", ParseIntPipe) id: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<CancelledFlightResponseDto>> {
    const data = await this.service.confirmPassengerBookingDetails(
      id,
      requestId,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Passenger booking details confirmed",
    );
  }

  // ── POST /cancelled-flights/:id/hotel-recommendations ───────────────────

  @Post(":id/hotel-recommendations")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary:
      "Generate hotel recommendations for all bookings of a cancelled flight",
    description:
      "Builds preferred/fallback room occupancies per booking, performs a single Hotelbeds availability search across deduplicated occupancies, and returns recommendation allocations without creating live hotel bookings.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/hotel-recommendations",
      "Cancelled flight not found",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      "/api/v1/cancelled-flights/:id/hotel-recommendations",
    ),
  })
  async getFlightHotelRecommendations(
    @Param("id", ParseIntPipe) id: number,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<object>> {
    requestLogger.info(
      `Fetching hotel recommendations for cancelled flight ${id}`,
    );
    const data = await this.service.getHotelRecommendationsForFlight(
      id,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel recommendations generated successfully",
    );
  }

  // ── POST /cancelled-flights/:id/hotel-recommendations ───────────────────

  @Post(":id/hotel-allocations")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary:
      "Generate hotel allocations for all bookings of a cancelled flight",
    description:
      "Builds preferred/fallback room occupancies per booking, performs a single Hotelbeds availability search across deduplicated occupancies, and returns hotel allocations without creating live hotel bookings.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight id" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/hotel-allocations",
      "Cancelled flight not found",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      "/api/v1/cancelled-flights/:id/hotel-allocations",
    ),
  })
  async getFlightHotelAllocations(
    @Param("id", ParseIntPipe) id: number,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<HotelAllocationsDto>> {
    requestLogger.info(`Fetching hotel allocations for cancelled flight ${id}`);
    const data = await this.service.hotelAllocationsForFlight(
      id,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Hotel allocation generated successfully",
    );
  }

  // ── GET /cancelled-flights/:id/bookings/:bookingId/hotel-recommendations ──

  @Get(":id/bookings/:bookingId/hotel-recommendations")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get AI-recommended hotels for a passenger on a cancelled flight",
    description:
      "Fetches a list of local candidate hotels and scores them dynamically using Groq's Llama model based on the passenger's class and special needs.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiParam({ name: "bookingId", description: "Booking UUID" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/:bookingId/hotel-recommendations",
      "Cancelled flight or booking not found",
    ),
  })
  async getHotelRecommendations(
    @Param("id", ParseIntPipe) id: number,
    @Param("bookingId", ParseIntPipe) bookingId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.getHotelRecommendations(
      id,
      bookingId,
      requestId,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "AI Hotel recommendations fetched successfully",
    );
  }

  // // ── POST /cancelled-flights/:id/bookings/:bookingId/allocate-hotel ───────

  // @Post(":id/bookings/:bookingId/allocate-hotel")
  // @RequireAccessControl({
  //   airline: {
  //     asset: AirlineAsset.CANCELLED_FLIGHTS,
  //     access: [AccessAction.EDIT],
  //   },
  // })
  // @ApiOperation({
  //   summary: "Allocate a hotel to a passenger booking",
  //   description: "Saves hotel details for a passenger's allocation record.",
  // })
  // @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  // @ApiParam({ name: "bookingId", description: "Booking UUID" })
  // @ApiNotFoundResponse({
  //   schema: createNotFoundErrorSchema(
  //     "/api/v1/cancelled-flights/:id/bookings/:bookingId/allocate-hotel",
  //     "Cancelled flight or booking not found",
  //   ),
  // })
  // async allocateHotel(
  //   @Param("id", ParseIntPipe) id: number,
  //   @Param("bookingId", ParseIntPipe) bookingId: number,
  //   @Body() dto: AllocateHotelDto,
  //   @RequestId() requestId: string,
  // ): Promise<BaseResponseDto<object>> {
  //   const data = await this.service.allocateHotel(
  //     id,
  //     bookingId,
  //     dto,
  //     requestId,
  //   );
  //   return BaseResponseDto.success(
  //     data,
  //     requestId,
  //     "Hotel allocated successfully",
  //   );
  // }

  // // ── POST /cancelled-flights/:id/bookings/:bookingId/check-rate ────────────

  // @Post(":id/bookings/:bookingId/check-rate")
  // @RequireAccessControl({
  //   airline: {
  //     asset: AirlineAsset.CANCELLED_FLIGHTS,
  //     access: [AccessAction.EDIT],
  //   },
  // })
  // @ApiOperation({
  //   summary: "Check rate key availability and pricing details",
  //   description:
  //     "Queries Hotelbeds CheckRate API to verify room rate availability, cancellation policies, and cost details.",
  // })
  // @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  // @ApiParam({ name: "bookingId", description: "Booking UUID" })
  // async checkRate(
  //   @Param("id", ParseIntPipe) id: number,
  //   @Param("bookingId", ParseIntPipe) bookingId: number,
  //   @Body() dto: CheckRateRequestDto,
  //   @RequestId() requestId: string,
  // ): Promise<BaseResponseDto<object>> {
  //   const data = await this.service.checkRate(
  //     id,
  //     bookingId,
  //     dto.rateKey,
  //     requestId,
  //   );
  //   return BaseResponseDto.success(
  //     data,
  //     requestId,
  //     "Room rate details retrieved successfully",
  //   );
  // }

  // // ── POST /cancelled-flights/:id/bookings/:bookingId/book-hotel ────────────

  // @Post(":id/bookings/:bookingId/book-hotel")
  // @RequireAccessControl({
  //   airline: {
  //     asset: AirlineAsset.CANCELLED_FLIGHTS,
  //     access: [AccessAction.EDIT],
  //   },
  // })
  // @ApiOperation({
  //   summary: "Perform live hotel reservation and allocate it to the booking",
  //   description:
  //     "Queries Hotelbeds Bookings API to confirm reservation, then stores allocation details in the database.",
  // })
  // @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  // @ApiParam({ name: "bookingId", description: "Booking UUID" })
  // async bookHotel(
  //   @Param("id", ParseIntPipe) id: number,
  //   @Param("bookingId", ParseIntPipe) bookingId: number,
  //   @Body() dto: BookHotelRequestDto,
  //   @RequestId() requestId: string,
  // ): Promise<BaseResponseDto<object>> {
  //   const data = await this.service.bookHotel(id, bookingId, dto, requestId);
  //   return BaseResponseDto.success(
  //     data,
  //     requestId,
  //     "Hotel booked and allocated successfully",
  //   );
  // }
}
