import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import { CreateCancelledFlightDto } from "./dto/create-cancelled-flight.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";
import { ImportBookingsConfirmDto } from "./dto/import-bookings.dto";

@ApiTags("Cancelled Flights")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.AIRLINE)
@Controller("cancelled-flights")
export class CancelledFlightsController {
  constructor(private readonly service: CancelledFlightsService) {}

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
    @Body() dto: CreateCancelledFlightDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.createCancelledFlight(dto, requestId);
    return BaseResponseDto.success(data, requestId, "Cancelled flight created");
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
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiCreatedResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
        timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
        message: { type: "string", example: "Booking added" },
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
    @Param("id") id: string,
    @Body() dto: CreateBookingDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
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
    summary: "Preview Excel import of bookings",
    description:
      "Parses an .xlsx file and returns a preview with valid/invalid rows. Nothing is saved.",
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
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings/import",
    ),
  })
  async importPreview(
    @Param("id") id: string,
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const ext = file.originalname?.split(".").pop()?.toLowerCase();
    if (
      ext !== "xlsx" &&
      file.mimetype !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      throw new BadRequestException("Only .xlsx files are accepted");
    }
    const data = await this.service.previewImport(id, file, requestId);
    return BaseResponseDto.success(data, requestId, "Import preview generated");
  }

  // ── POST /cancelled-flights/:id/bookings/import/confirm ─────────────────

  @Post(":id/bookings/import/confirm")
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.CANCELLED_FLIGHTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Confirm and save imported bookings",
    description:
      "Saves valid rows from an import preview. Duplicate PNRs per flight are skipped.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  async confirmImport(
    @Param("id") id: string,
    @Body() dto: ImportBookingsConfirmDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.confirmImport(id, dto, requestId);
    return BaseResponseDto.success(data, requestId, "Bookings imported");
  }

  // ── PUT /cancelled-flights/:id/bookings/:bookingId ───────────────────────

  @Put(":id/bookings/:bookingId")
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
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiParam({ name: "bookingId", description: "Booking UUID" })
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
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
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
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiParam({ name: "bookingId", description: "Booking UUID" })
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
    @Param("id") id: string,
    @Param("bookingId") bookingId: string,
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
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/bookings",
      "Cancelled flight not found",
    ),
  })
  async listBookings(
    @Param("id") id: string,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.listBookings(id, requestId);
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
    description:
      "Returns full flight details with route, bookings, and summary counts.",
  })
  @ApiParam({ name: "id", description: "Cancelled flight UUID" })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/cancelled-flights/:id/review",
      "Cancelled flight not found",
    ),
  })
  async reviewFlight(
    @Param("id") id: string,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<object>> {
    const data = await this.service.reviewFlight(id, requestId);
    return BaseResponseDto.success(
      data,
      requestId,
      "Flight review fetched successfully",
    );
  }
}
