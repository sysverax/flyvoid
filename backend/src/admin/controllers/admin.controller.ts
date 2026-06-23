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
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "../../auth/interfaces/authenticated-request.interface";
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
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AdminRole, UserType } from "../../common/constants/user.constants";
import {
  RequireAccessControl,
  RequireUserRoles,
  RequireUserTypes,
} from "../../auth/decorators/rbac.decorator";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import {
  AdminProfileDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
  InviteAdminUserRequestDto,
  InviteAdminUserResponseDto,
  UpdateAdminUserRequestDto,
} from "../dto";
import { AdminService } from "../services/admin.service";
import { RbacGuard } from "../../auth/guards/rbac.guard";

const adminProfileSuccessExample = {
  success: true,
  requestId: REQUEST_ID_EXAMPLE,
  timestamp: TIMESTAMP_EXAMPLE,
  message: "Logged-in admin profile fetched successfully",
  data: {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "admin@example.com",
    role: "SUPER_ADMIN",
    accessControls: [
      {
        asset: "AIRLINES",
        access: ["VIEW", "CREATE", "EDIT"],
      },
      {
        asset: "PAYMENTS",
        access: ["VIEW", "EXPORT"],
      },
    ],
  },
};

@ApiExtraModels(
  BaseResponseDto,
  AdminProfileDto,
  AdminUserResponseDto,
  InviteAdminUserRequestDto,
  InviteAdminUserResponseDto,
  UpdateAdminUserRequestDto,
  AdminUserListResponseDto,
)
@ApiTags("Admin")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("profile")
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.PROFILE,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get logged-in admin profile",
    description: `
    Returns the profile of the currently authenticated platform admin, including assigned access controls.
      Access: SUPER_ADMIN and STAFF with VIEW access on the PROFILE asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Authenticated admin must be active (401 if not found or inactive)`,
  })
  @ApiOkResponse({
    description: "Logged-in admin profile fetched successfully",
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
              example: "Logged-in admin profile fetched successfully",
            },
            data: { $ref: getSchemaPath(AdminProfileDto) },
          },
        },
      ],
      example: adminProfileSuccessExample,
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    headers: {
      "x-request-id": REQUEST_ID_HEADER_SCHEMA,
    },
    schema: createUnauthorizedErrorSchema(
      "/api/v1/admin/profile",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  async getLoggedInAdminProfile(
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminProfileDto>> {
    const profile = await this.adminService.getLoggedInAdminProfile(
      req.user,
      requestId,
    );

    return BaseResponseDto.success(
      profile,
      requestId,
      "Logged-in admin profile fetched successfully",
    );
  }

  @Post("users")
  @HttpCode(201)
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.ADMIN_USERS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Invite admin user",
    description: `
    Creates and invites a new platform admin user, returning a temporary password for first login.
      Access: SUPER_ADMIN and STAFF with EDIT access on the ADMIN_USERS asset. Requires userType=PLATFORM.
      Business logic validations (409 Conflict):
        1. Email must not already exist on another admin account`,
  })
  @ApiBody({ type: InviteAdminUserRequestDto })
  @ApiCreatedResponse({
    description: "Admin user invited successfully",
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
              example: "Admin user invited successfully",
            },
            data: { $ref: getSchemaPath(InviteAdminUserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/admin/users"),
  })
  @ApiConflictResponse({
    description: "Admin email already exists",
    schema: createConflictErrorSchema(
      "/api/v1/admin/users",
      "Admin email already exists",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/admin/users",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async inviteAdminUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InviteAdminUserRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<InviteAdminUserResponseDto>> {
    const response = await this.adminService.inviteAdminUser(
      req.user,
      dto,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "Admin user invited successfully",
    );
  }

  @Patch("users/:adminId")
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: { asset: PlatformAsset.ADMIN_USERS, access: [AccessAction.EDIT] },
  })
  @ApiOperation({
    summary: "Update admin user",
    description: `
    Partially updates a platform admin user's profile (name, email, role) and/or active status (suspend/activate).
      Access: SUPER_ADMIN and STAFF with EDIT access on the ADMIN_USERS asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Target admin must exist (404 if not found)
        2. Email must not already be in use by another admin (409 Conflict)`,
  })
  @ApiBody({ type: UpdateAdminUserRequestDto })
  @ApiOkResponse({
    description: "Admin user updated successfully",
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
              example: "Admin user updated successfully",
            },
            data: { $ref: getSchemaPath(AdminUserResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/admin/users/2"),
  })
  @ApiNotFoundResponse({
    description: "Admin user not found",
    schema: createNotFoundErrorSchema(
      "/api/v1/admin/users/2",
      "Admin user not found",
    ),
  })
  @ApiConflictResponse({
    description: "Admin email already exists",
    schema: createConflictErrorSchema(
      "/api/v1/admin/users/2",
      "Admin email already exists",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/admin/users/2",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async updateAdminUser(
    @Req() req: AuthenticatedRequest,
    @Param("adminId", ParseIntPipe) adminId: number,
    @Body() dto: UpdateAdminUserRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminUserResponseDto>> {
    const response = await this.adminService.updateAdminUser(
      req.user,
      adminId,
      dto,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "Admin user updated successfully",
    );
  }

  @Delete("users/:adminId")
  @HttpCode(200)
  @RequireUserRoles(AdminRole.SUPER_ADMIN)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.ADMIN_USERS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Delete admin user",
    description: `
    Permanently deletes a platform admin user account.
      Access: SUPER_ADMIN with EDIT access on the ADMIN_USERS asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Target admin must exist (404 if not found)
        2. SUPER_ADMIN accounts cannot be deleted (400 Bad Request)`,
  })
  @ApiOkResponse({
    description: "Admin user deleted successfully",
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
              example: "Admin user deleted successfully",
            },
            data: { type: "null", example: null },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/admin/users/2"),
  })
  @ApiNotFoundResponse({
    description: "Admin user not found",
    schema: createNotFoundErrorSchema(
      "/api/v1/admin/users/2",
      "Admin user not found",
    ),
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/admin/users/2",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async deleteAdminUser(
    @Req() req: AuthenticatedRequest,
    @Param("adminId", ParseIntPipe) adminId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<null>> {
    await this.adminService.deleteAdminUser(req.user, adminId, requestId);
    return BaseResponseDto.success(
      null,
      requestId,
      "Admin user deleted successfully",
    );
  }

  @Get("users")
  @RequireUserRoles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
  @RequireAccessControl({
    platform: { asset: PlatformAsset.ADMIN_USERS, access: [AccessAction.VIEW] },
  })
  @ApiOperation({
    summary: "View all admin users",
    description: `
    Returns a paginated list of all platform admin users.
      Access: SUPER_ADMIN and STAFF with VIEW access on the ADMIN_USERS asset. Requires userType=PLATFORM.
      Filters:
        1. page (pagination, min 1)
        2. limit (items per page)`,
  })
  @ApiOkResponse({
    description: "Admin users fetched successfully",
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
              example: "Admin users fetched successfully",
            },
            data: { $ref: getSchemaPath(AdminUserListResponseDto) },
          },
        },
      ],
    },
  })
  @ApiForbiddenResponse({
    description:
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    schema: createForbiddenErrorSchema(
      "/api/v1/admin/users",
      "Only SUPER_ADMIN and STAFF who has the required permissions can perform this action",
    ),
  })
  async listAdminUsers(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminUserListResponseDto>> {
    const response = await this.adminService.listAdminUsers(
      req.user,
      pagination,
      requestId,
    );
    return BaseResponseDto.success(
      response,
      requestId,
      "Admin users fetched successfully",
    );
  }
}
