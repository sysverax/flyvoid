import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import {
  RequireAccessControl,
  RequireUserRoles,
  RequireUserTypes,
} from "../../auth/decorators/rbac.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../../auth/guards/rbac.guard";
import { AuthenticatedRequest } from "../../auth/interfaces/authenticated-request.interface";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import {
  REQUEST_ID_EXAMPLE,
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createConflictErrorSchema,
  createForbiddenErrorSchema,
  createNotFoundErrorSchema,
  createUnauthorizedErrorSchema,
} from "../../common/constants/swagger.constants";
import { AdminRole, UserType } from "../../common/constants/user.constants";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import { RequestId } from "../../common/decorators/request-id.decorator";
import {
  AirportResponseDto,
  CreateAirportRequestDto,
  UpdateAirportRequestDto,
} from "../dto";
import { AirportService } from "../services/airport.service";

@ApiTags("Airport")
@ApiExtraModels(BaseResponseDto, AirportResponseDto)
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM)
@Controller("airports")
export class AirportController {
  constructor(private readonly airportService: AirportService) {}

  @Post("/")
  @HttpCode(201)
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRPORTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Create airport",
    description:
      "Accessible to SUPER_ADMIN and STAFF with EDIT access for AIRPORTS platform asset.",
  })
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Airport created" },
            data: { $ref: getSchemaPath(AirportResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/airports"),
  })
  @ApiConflictResponse({
    schema: createConflictErrorSchema(
      "/api/v1/airports",
      "Airport IATA code already exists",
    ),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema("/api/v1/airports", "Unauthorized"),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      "/api/v1/airports",
      "Insufficient permissions",
    ),
  })
  async createAirport(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAirportRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirportResponseDto>> {
    const data = await this.airportService.createAirport(
      req.user,
      dto,
      requestId,
    );

    return BaseResponseDto.success(data, requestId, "Airport created");
  }

  @Patch("/:airportId")
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRPORTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Update airport",
    description:
      "Accessible to SUPER_ADMIN and STAFF with EDIT access for AIRPORTS platform asset.",
  })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: { type: "string", example: "Airport updated" },
            data: { $ref: getSchemaPath(AirportResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/airports/1"),
  })
  @ApiConflictResponse({
    schema: createConflictErrorSchema(
      "/api/v1/airports/1",
      "Airport ICAO code already exists",
    ),
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/airports/1",
      "Airport not found",
    ),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema("/api/v1/airports/1", "Unauthorized"),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      "/api/v1/airports/1",
      "Insufficient permissions",
    ),
  })
  async updateAirport(
    @Req() req: AuthenticatedRequest,
    @Param("airportId", ParseIntPipe) airportId: number,
    @Body() dto: UpdateAirportRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirportResponseDto>> {
    UpdateAirportRequestDto.validateForUpdate(dto);

    const data = await this.airportService.updateAirport(
      req.user,
      airportId,
      dto,
      requestId,
    );

    return BaseResponseDto.success(data, requestId, "Airport updated");
  }
}
