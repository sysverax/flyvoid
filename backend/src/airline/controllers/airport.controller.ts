import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
  AirlineAsset,
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
  AirportListResponseDto,
  AirportResponseDto,
  CreateAirportRequestDto,
  GetAirportsQueryDto,
  UpdateAirlineAirportsRequestDto,
  UpdateAirlineAirportsResponseDto,
  UpdateAirportRequestDto,
  GetAirportsWithAssignmentQueryDto,
  AirportListWithAssignmentResponseDto,
} from "../dto/airports";
import { AirportService } from "../services/airport.service";

@ApiTags("Airport")
@ApiExtraModels(
  BaseResponseDto,
  AirportResponseDto,
  AirportListResponseDto,
  UpdateAirlineAirportsResponseDto,
  UpdateAirlineAirportsRequestDto,
  UpdateAirportRequestDto,
  GetAirportsWithAssignmentQueryDto,
  AirportListWithAssignmentResponseDto,
)
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller("airports")
export class AirportController {
  constructor(private readonly airportService: AirportService) {}

  @Get("/")
  @RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
  // @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRPORTS,
      access: [AccessAction.VIEW],
    },
    airline: {
      asset: AirlineAsset.AIRPORTS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get all airports",
    description: `
    Returns a paginated list of airports. 
      Accessible to SUPER_ADMIN and STAFF with VIEW access on the AIRPORTS asset.
      Accessible to AIRLINE users with VIEW access on the AIRPORTS asset.
      Supports optional filters: 
        1. countryCode (2-letter ISO alpha-2)
        2. status (active/inactive) - not supported for AIRLINE users, as they only see active airports.
        3. free-text search on airport name, IATA code, or ICAO code. 
      Validations
        1. page must be >= 1
        2. countryCode must be exactly 2 uppercase letters`,
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
            message: {
              type: "string",
              example: "Airports fetched successfully",
            },
            data: { $ref: getSchemaPath(AirportListResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/airports"),
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
  async getAirports(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetAirportsQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirportListResponseDto>> {
    const data = await this.airportService.listAirports(
      req.user,
      query,
      requestId,
    );

    return BaseResponseDto.success(
      data,
      requestId,
      "Airports fetched successfully",
    );
  }

  @Post("/")
  @HttpCode(201)
  @RequireUserTypes(UserType.PLATFORM)
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
    description: `
    Creates a new airport. 
      Accessible to SUPER_ADMIN and STAFF with EDIT access on the AIRPORTS asset. 
      All fields are required except address and postalCode. 
      Validations: 
        1. name (max 150 chars, no injection chars)
        2. iataCode (exactly 3 uppercase letters, must be unique)
        3. icaoCode (exactly 4 uppercase letters, must be unique)
        4. countryCode (2-letter ISO alpha-2)
        5. city (max 100 chars)
        6. latitude (valid decimal -90 to 90)
        7. longitude (valid decimal -180 to 180)
        8. timezone (max 100 chars)`,
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
  @RequireUserTypes(UserType.PLATFORM)
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
    description: `
    Partially updates an existing airport. 
        Accessible to SUPER_ADMIN and STAFF with EDIT access on the AIRPORTS asset. 
        validations:
          1. At least one field must be provided. Null values are rejected for all fields except address. 
          2. If iataCode or icaoCode is provided, uniqueness is enforced across all airports.`,
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

  @Patch("/airlines/:airlineId/assignments")
  @RequireUserTypes(UserType.PLATFORM)
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRLINES,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Assign or disable airports for an airline",
    description: `
    Bulk operation to assign and/or disable airports for an active airline in a single request. 
      Accessible to SUPER_ADMIN and STAFF with EDIT access on the AIRLINES asset. 
      Validations: 
        1. At least one of assignAirportIds or disableAirportIds must be non-empty; 
        2. The same airport ID cannot appear in both lists; 
        3. All provided airport IDs must exist in the system; 
        4. The airline must be active. 
        5. Already-active airports in assignAirportIds and already-disabled airports in disableAirportIds are silently skipped. 
      The response reflects only the IDs that actually changed state.`,
  })
  @ApiBody({ type: UpdateAirlineAirportsRequestDto })
  @ApiOkResponse({
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
              example: "Airline airport assignments updated",
            },
            data: { $ref: getSchemaPath(UpdateAirlineAirportsResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema(
      "/api/v1/airports/airlines/:airlineId/assignments",
    ),
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/airports/airlines/:airlineId/assignments",
      "Airline not found",
    ),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airports/airlines/:airlineId/assignments",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      "/api/v1/airports/airlines/:airlineId/assignments",
      "Insufficient permissions",
    ),
  })
  async updateAirlineAirports(
    @Req() req: AuthenticatedRequest,
    @Param("airlineId", ParseIntPipe) airlineId: number,
    @Body() dto: UpdateAirlineAirportsRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<UpdateAirlineAirportsResponseDto>> {
    const data = await this.airportService.updateAirlineAirports(
      req.user,
      airlineId,
      dto,
      requestId,
    );

    return BaseResponseDto.success(
      data,
      requestId,
      "Airline airport assignments updated",
    );
  }

  // get all airports with assignment tag for a specific airline. This endpoint is accessible to PLATFORM users
  @Get("/airlines/:airlineId/airports")
  @RequireUserTypes(UserType.PLATFORM)
  @RequireAccessControl({
    platform: {
      asset: [PlatformAsset.AIRLINES],
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get all airports with assignment status for a specific airline",
    description: `
    Returns a paginated list of airports. 
      Accessible to SUPER_ADMIN and STAFF with VIEW access on the AIRLINES asset.
      Supports optional filters: 
        1. countryCode (2-letter ISO alpha-2)
        2. status (active/inactive) - not supported for AIRLINE users, as they only see active airports.
        3. free-text search on airport name, IATA code, or ICAO code. 
      Validations
        1. page must be >= 1
        2. countryCode must be exactly 2 uppercase letters`,
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
            message: {
              type: "string",
              example: "Airports fetched successfully",
            },
            data: { $ref: getSchemaPath(AirportListWithAssignmentResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/airlines/:airlineId/airports"),
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airlines/:airlineId/airports",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    schema: createForbiddenErrorSchema(
      "/api/v1/airlines/:airlineId/airports",
      "Insufficient permissions",
    ),
  })
  async getAirportsWithAssignment(
    @Param("airlineId", ParseIntPipe) airlineId: number,
    @Req() req: AuthenticatedRequest,
    @Query() query: GetAirportsWithAssignmentQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirportListWithAssignmentResponseDto>> {
    const data = await this.airportService.listAirportsWithAssignment(
      req.user,
      airlineId,
      query,
      requestId,
    );

    return BaseResponseDto.success(
      data,
      requestId,
      "Airports fetched successfully",
    );
  }
}
