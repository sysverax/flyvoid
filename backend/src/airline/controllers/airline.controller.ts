import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import {
  REQUEST_ID_EXAMPLE,
  REQUEST_ID_HEADER_SCHEMA,
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createConflictErrorSchema,
  createForbiddenErrorSchema,
  createNotFoundErrorSchema,
} from "../../common/constants/swagger.constants";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import { RequestId } from "../../common/decorators/request-id.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../../auth/guards/rbac.guard";
import {
  RequireAccessControl,
  RequireUserRoles,
  RequireUserTypes,
} from "../../auth/decorators/rbac.decorator";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import { AdminRole, UserType } from "../../common/constants/user.constants";
import {
  AdminAirlineListResponseDto,
  AdminAirlineQueryDto,
  AdminAirlineResponseDto,
  UpdateAirlineRequestDto,
} from "../dto";
import { AirlineService } from "../services/airline.service";

@ApiTags("Airlines")
@ApiExtraModels(
  BaseResponseDto,
  AdminAirlineResponseDto,
  AdminAirlineListResponseDto,
  UpdateAirlineRequestDto,
)
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM)
@Controller("airline")
export class AirlineController {
  constructor(private readonly airlineService: AirlineService) {}

  @Get()
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRLINES,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "List all airlines",
    description: `
    Returns a paginated list of all airlines.
      Access: SUPER_ADMIN and STAFF with VIEW access on the AIRLINES asset. Requires userType=PLATFORM.
      Filters:
        1. search — match on airline name or code (case-insensitive)
        2. isActive — filter by active status
        3. isSuspended — filter by suspended status
        4. page / limit — pagination`,
  })
  @ApiOkResponse({
    description: "Airlines fetched successfully",
    headers: { "x-request-id": REQUEST_ID_HEADER_SCHEMA },
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: {
              type: "string",
              example: "Airlines fetched successfully",
            },
            data: { $ref: getSchemaPath(AdminAirlineListResponseDto) },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async listAirlines(
    @Query() query: AdminAirlineQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminAirlineListResponseDto>> {
    const response = await this.airlineService.listAirlines(query, requestId);

    return BaseResponseDto.success(
      response,
      requestId,
      "Airlines fetched successfully",
    );
  }

  @Get(":airlineId")
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRLINES,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get airline details",
    description: `
    Returns full details of a specific airline including its admin user.
      Access: SUPER_ADMIN and STAFF with VIEW access on the AIRLINES asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Airline must exist (404 if not found)`,
  })
  @ApiOkResponse({
    description: "Airline fetched successfully",
    headers: { "x-request-id": REQUEST_ID_HEADER_SCHEMA },
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: {
              type: "string",
              example: "Airline fetched successfully",
            },
            data: { $ref: getSchemaPath(AdminAirlineResponseDto) },
          },
        },
      ],
    },
  })
  @ApiNotFoundResponse({
    description: "Airline not found",
    schema: createNotFoundErrorSchema(
      "/api/v1/airline/12",
      "Airline not found",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline/12",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async getAirlineById(
    @Param("airlineId", ParseIntPipe) airlineId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminAirlineResponseDto>> {
    const response = await this.airlineService.getAirlineById(
      airlineId,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline fetched successfully",
    );
  }

  @Patch(":airlineId")
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRLINES,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Update airline details",
    description: `
    Partially updates an airline's details and/or its admin user's profile.
      Access: SUPER_ADMIN and STAFF with EDIT access on the AIRLINES asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Airline must exist (404 if not found)
        2. Airline code must be unique across all airlines (409 if taken)
        3. Company registration number must be unique (409 if taken)
        4. Admin email must not be used by another airline user (409 if taken)
        5. Airline admin user must exist to update admin fields (404 if not found)`,
  })
  @ApiBody({ type: UpdateAirlineRequestDto })
  @ApiOkResponse({
    description: "Airline updated successfully",
    headers: { "x-request-id": REQUEST_ID_HEADER_SCHEMA },
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseResponseDto) },
        {
          properties: {
            success: { type: "boolean", example: true },
            requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
            timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
            message: {
              type: "string",
              example: "Airline updated successfully",
            },
            data: { $ref: getSchemaPath(AdminAirlineResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/airline/12"),
  })
  @ApiNotFoundResponse({
    description: "Airline not found",
    schema: createNotFoundErrorSchema(
      "/api/v1/airline/12",
      "Airline not found",
    ),
  })
  @ApiConflictResponse({
    description: "Airline code / CRN / admin email already exists",
    schema: createConflictErrorSchema(
      "/api/v1/airline/12",
      "Airline code already exists",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline/12",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async updateAirline(
    @Param("airlineId", ParseIntPipe) airlineId: number,
    @Body() dto: UpdateAirlineRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminAirlineResponseDto>> {
    const response = await this.airlineService.updateAirline(
      airlineId,
      dto,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline updated successfully",
    );
  }
}
