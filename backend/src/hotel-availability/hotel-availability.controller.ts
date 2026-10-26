import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { Logger } from "winston";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../auth/guards/rbac.guard";
import {
  RequireAccessControl,
  RequireUserTypes,
} from "../auth/decorators/rbac.decorator";
import {
  AccessAction,
  PlatformAsset,
} from "../common/constants/access-control.constants";
import { UserType } from "../common/constants/user.constants";
import { BaseResponseDto } from "../common/dto/base-response.dto";
import { RequestId } from "../common/decorators/request-id.decorator";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import { createBadRequestErrorSchema } from "../common/constants/swagger.constants";
import { HotelAvailabilityQueryDto } from "./dto/hotel-availability-query.dto";
import { HotelAvailabilityResponseDto } from "./dto/hotel-availability-response.dto";
import { HotelAvailabilityService } from "./hotel-availability.service";

@ApiTags("Hotel Availability")
@ApiBearerAuth("access-token")
@ApiExtraModels(HotelAvailabilityResponseDto)
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM)
@Controller("hotel-availability")
export class HotelAvailabilityController {
  private readonly context = "HotelAvailabilityController";

  constructor(private readonly hotelAvailabilityService: HotelAvailabilityService) {}

  // ── GET /hotel-availability ──────────────────────────────────────────────
  @Get()
  @RequireAccessControl({
    platform: { asset: PlatformAsset.HOTELS, access: [AccessAction.VIEW] },
  })
  @ApiOperation({
    summary: "Search live hotel availability near an airport",
    description:
      "Platform users with HOTELS VIEW. Calls the chosen supplier live (one call per search: 1 room = one search, 2–9 rooms = one multiroom search; RateHawk allows 10 searches/min shared with allocation). Read only: nothing is booked or held. checkInDate/checkOutDate are calendar dates at the hotel (YYYY-MM-DD, no timezone conversion); check-in must be today or later at the airport, at most 30 nights. rooms is a JSON array, e.g. [{\"adults\":2,\"childrenAges\":[7]}]. radius is in km (1–70, default HOTEL_SEARCH_RADIUS); residency defaults to the airport's country. Prices are the supplier net price (pricePerNight and totalPrice cover all rooms). Hotels are sorted nearest first, then cheapest; an empty list means nothing available.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(HotelAvailabilityResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/hotel-availability"),
  })
  async searchAvailability(
    @Query() query: HotelAvailabilityQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<HotelAvailabilityResponseDto>> {
    requestLogger.info("Hotel availability search requested", {
      context: this.context,
      query,
    });
    const result = await this.hotelAvailabilityService.searchAvailability(
      query,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      result,
      requestId,
      "Hotel availability fetched successfully",
    );
  }
}
