import {
  Body,
  Controller,
  Delete,
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
  REQUEST_ID_EXAMPLE,
  REQUEST_ID_HEADER_SCHEMA,
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createConflictErrorSchema,
  createForbiddenErrorSchema,
  createNotFoundErrorSchema,
  createUnauthorizedErrorSchema,
} from "../../common/constants/swagger.constants";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import { RequestId } from "../../common/decorators/request-id.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "../../auth/interfaces/authenticated-request.interface";
import { RbacGuard } from "../../auth/guards/rbac.guard";
import {
  RequireAccessControl,
  RequireUserRoles,
  RequireUserTypes,
} from "../../auth/decorators/rbac.decorator";
import {
  AccessAction,
  AirlineAsset,
} from "../../common/constants/access-control.constants";
import { AirlineRole, UserType } from "../../common/constants/user.constants";
import {
  AirlineProfileResponseDto,
  AirlineUserListResponseDto,
  AirlineUserResponseDto,
  AirlineUserProfileResponseDto,
  InviteAirlineUserRequestDto,
  InviteAirlineUserResponseDto,
  UpdateAirlineUserRequestDto,
} from "../dto";
import { AirlineUserService } from "../services/airline-user.service";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

@ApiTags("Airline Users")
@ApiExtraModels(
  BaseResponseDto,
  AirlineUserResponseDto,
  InviteAirlineUserRequestDto,
  InviteAirlineUserResponseDto,
  UpdateAirlineUserRequestDto,
  AirlineUserListResponseDto,
)
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.AIRLINE)
@Controller("airline/users")
export class AirlineUserController {
  constructor(private readonly airlineUserService: AirlineUserService) {}

  @Post("/")
  @HttpCode(201)
  @RequireUserRoles(AirlineRole.AIRLINE_ADMIN, AirlineRole.AIRLINE_STAFF)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.AIRLINE_USERS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Invite airline user",
    description: `
    Creates and invites a new airline user, returning a temporary password for first login.
      Access: AIRLINE_ADMIN and AIRLINE_STAFF with EDIT access on the AIRLINE_USERS asset. Requires userType=AIRLINE.
      Business logic validations (409 Conflict):
        1. Email must not already exist on another airline account`,
  })
  @ApiBody({ type: InviteAirlineUserRequestDto })
  @ApiCreatedResponse({
    description: "Airline user invited successfully",
    headers: {
      "x-request-id": REQUEST_ID_HEADER_SCHEMA,
    },
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
              example: "Airline user invited successfully",
            },
            data: { $ref: getSchemaPath(InviteAirlineUserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/airline/users"),
  })
  @ApiConflictResponse({
    description: "Airline user email already exists",
    schema: createConflictErrorSchema(
      "/api/v1/airline/users",
      "Airline user email already exists",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline/users",
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    ),
  })
  async inviteAirlineUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InviteAirlineUserRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<InviteAirlineUserResponseDto>> {
    const response = await this.airlineUserService.inviteAirlineUser(
      req.user,
      dto,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline user invited successfully",
    );
  }

  @Patch(":userId")
  @RequireUserRoles(AirlineRole.AIRLINE_ADMIN, AirlineRole.AIRLINE_STAFF)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.AIRLINE_USERS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Update airline user",
    description: `
    Partially updates an airline user's profile (name, email, job title, role) and/or active status (suspend/activate).
      Access: AIRLINE_ADMIN and AIRLINE_STAFF with EDIT access on the AIRLINE_USERS asset. Requires userType=AIRLINE.
      Business logic validations:
        1. Target airline user must exist within same airline (404 if not found)
        2. Email must not already be in use by another user (409 Conflict)`,
  })
  @ApiBody({ type: UpdateAirlineUserRequestDto })
  @ApiOkResponse({
    description: "Airline user updated successfully",
    headers: {
      "x-request-id": REQUEST_ID_HEADER_SCHEMA,
    },
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
              example: "Airline user updated successfully",
            },
            data: { $ref: getSchemaPath(AirlineUserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/airline/users/2"),
  })
  @ApiNotFoundResponse({
    description: "Airline user not found",
    schema: createNotFoundErrorSchema(
      "/api/v1/airline/users/2",
      "Airline user not found",
    ),
  })
  @ApiConflictResponse({
    description: "Airline user email already exists",
    schema: createConflictErrorSchema(
      "/api/v1/airline/users/2",
      "Airline user email already exists",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline/users/2",
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    ),
  })
  async updateAirlineUser(
    @Req() req: AuthenticatedRequest,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() dto: UpdateAirlineUserRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineUserResponseDto>> {
    const response = await this.airlineUserService.updateAirlineUser(
      req.user,
      userId,
      dto,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline user updated successfully",
    );
  }

  @Delete(":userId")
  @HttpCode(200)
  @RequireUserRoles(AirlineRole.AIRLINE_ADMIN)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.AIRLINE_USERS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Delete airline user",
    description: `
    Permanently deletes an airline user account.
      Access: AIRLINE_ADMIN with EDIT access on the AIRLINE_USERS asset. Requires userType=AIRLINE.
      Business logic validations:
        1. Target user must exist within same airline (404 if not found)
        2. AIRLINE_ADMIN accounts cannot be deleted (403 Forbidden)`,
  })
  @ApiOkResponse({
    description: "Airline user deleted successfully",
    headers: {
      "x-request-id": REQUEST_ID_HEADER_SCHEMA,
    },
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
              example: "Airline user deleted successfully",
            },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/airline/users/2"),
  })
  @ApiNotFoundResponse({
    description: "Airline user not found",
    schema: createNotFoundErrorSchema(
      "/api/v1/airline/users/2",
      "Airline user not found",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline/users/2",
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    ),
  })
  async deleteAirlineUser(
    @Req() req: AuthenticatedRequest,
    @Param("userId", ParseIntPipe) userId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.airlineUserService.deleteAirlineUser(
      req.user,
      userId,
      requestId,
    );

    return BaseResponseDto.success(
      null,
      requestId,
      "Airline user deleted successfully",
    );
  }

  @Get("/")
  @RequireUserRoles(AirlineRole.AIRLINE_ADMIN, AirlineRole.AIRLINE_STAFF)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.AIRLINE_USERS,
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "View all airline users",
    description: `
    Returns a paginated list of all users in the authenticated airline.
      Access: AIRLINE_ADMIN and AIRLINE_STAFF with VIEW access on the AIRLINE_USERS asset. Requires userType=AIRLINE.
      Filters:
        1. page (pagination, min 1)
        2. limit (items per page)`,
  })
  @ApiOkResponse({
    description: "Airline users fetched successfully",
    headers: {
      "x-request-id": REQUEST_ID_HEADER_SCHEMA,
    },
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
              example: "Airline users fetched successfully",
            },
            data: { $ref: getSchemaPath(AirlineUserListResponseDto) },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/airline/users",
      "Only AIRLINE_ADMIN and AIRLINE_STAFF who has the required permissions can perform this action",
    ),
  })
  async listAirlineUsers(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineUserListResponseDto>> {
    const response = await this.airlineUserService.listAirlineUsers(
      req.user,
      pagination,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline users fetched successfully",
    );
  }

  @Get("profile")
  @RequireUserRoles(AirlineRole.AIRLINE_ADMIN, AirlineRole.AIRLINE_STAFF)
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.PROFILE,
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Airline user profile",
    description: `
    Returns the authenticated airline user's own profile.
      Access: AIRLINE_ADMIN and AIRLINE_STAFF with VIEW access on the PROFILE asset. Requires userType=AIRLINE.
      Business logic validations:
        1. Authenticated user must be an active airline user (401 if not found or inactive)`,
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
              example: "Airline user profile fetched",
            },
            data: { $ref: getSchemaPath(AirlineUserProfileResponseDto) },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. AIRLINE user type is required.",
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/user/profile",
      "Unauthorized",
    ),
  })
  async getUserProfile(
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineUserProfileResponseDto>> {
    const response = await this.airlineUserService.getUserProfile(
      req.user,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "Airline user profile fetched",
    );
  }

  @Get("profile")
  @RequireUserRoles(AirlineRole.AIRLINE_ADMIN)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Airline profile",
    description: `
    Returns the airline profile associated with the authenticated airline admin's account.
      Access: AIRLINE_ADMIN only. Requires userType=AIRLINE.
      Business logic validations:
        1. Authenticated user must be an active airline user (401 if not found or inactive)
        2. Associated airline must be active (401 if not found or inactive)`,
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
            message: { type: "string", example: "Airline profile fetched" },
            data: { $ref: getSchemaPath(AirlineProfileResponseDto) },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      "Insufficient permissions. AIRLINE_ADMIN role is required for this endpoint.",
  })
  @ApiUnauthorizedResponse({
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/profile",
      "Unauthorized",
    ),
  })
  async getAirlineProfile(
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineProfileResponseDto>> {
    const response = await this.airlineUserService.getAirlineProfile(
      req.user,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "Airline profile fetched",
    );
  }
}
