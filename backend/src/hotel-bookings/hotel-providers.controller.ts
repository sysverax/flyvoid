import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { Repository } from "typeorm";
import { Logger } from "winston";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../auth/guards/rbac.guard";
import { RequireUserTypes } from "../auth/decorators/rbac.decorator";
import { UserType } from "../common/constants/user.constants";
import { BaseResponseDto } from "../common/dto/base-response.dto";
import { RequestId } from "../common/decorators/request-id.decorator";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import { createBadRequestErrorSchema } from "../common/constants/swagger.constants";
import { ProviderEntity } from "../cancelled-flights/entities/provider.entity";
import {
  GetHotelProvidersQueryDto,
  HotelProviderListResponseDto,
} from "./dto/hotel-providers.dto";

@ApiTags("Hotel Providers")
@ApiBearerAuth("access-token")
@ApiExtraModels(HotelProviderListResponseDto)
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM)
@Controller("hotel-providers")
export class HotelProvidersController {
  private readonly context = "HotelProvidersController";

  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepository: Repository<ProviderEntity>,
  ) {}

  // ── GET /hotel-providers ─────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: "List hotel providers",
    description:
      "Platform users only (no extra permission). Returns every hotel supplier (id, code, name, isActive), ordered by name; not paginated. Optional isActive=true/false filter. Used for the hotel bookings provider filter.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(HotelProviderListResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/hotel-providers"),
  })
  async listProviders(
    @Query() query: GetHotelProvidersQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<HotelProviderListResponseDto>> {
    requestLogger.info("Listing hotel providers", { context: this.context, query });
    const providers = await this.providerRepository.find({
      where: query.isActive === undefined ? {} : { isActive: query.isActive },
      order: { name: "ASC" },
    });
    return BaseResponseDto.success(
      {
        providers: providers.map(({ id, code, name, isActive }) => ({
          id,
          code,
          name,
          isActive,
        })),
      },
      requestId,
      "Hotel providers fetched successfully",
    );
  }
}
