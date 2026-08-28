import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
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
  TIMESTAMP_EXAMPLE,
  createBadRequestErrorSchema,
  createConflictErrorSchema,
  createNotFoundErrorSchema,
  createUnauthorizedErrorSchema,
} from "../../common/constants/swagger.constants";
import { UserType } from "../../common/constants/user.constants";
import { RequestId } from "../../common/decorators/request-id.decorator";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import {
  RequireAccessControl,
  RequireUserTypes,
} from "../../auth/decorators/rbac.decorator";
import {
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
} from "../../auth/dto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../../auth/guards/rbac.guard";
import { AuthenticatedRequest } from "../../auth/interfaces/authenticated-request.interface";
import {
  AirlineInvitationListResponseDto,
  AirlineInvitationMatrixResponseDto,
  ResendAirlineInvitationResponseDto,
  RevokeAirlineInvitationResponseDto,
  AirlineInvitationDetailResponseDto,
  AirlineInvitationHistoryItemDto,
} from "../dto/airline-invitation";
import { AirlineInvitationService } from "../services/airline-invitation.service";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import { AirlineInvitationListRequestDto } from "../dto/airline-invitation/airline-invitation-list-request.dto";

@ApiTags("Airline Invitations")
@ApiExtraModels(
  BaseResponseDto,
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
  AirlineInvitationListResponseDto,
  AirlineInvitationDetailResponseDto,
  AirlineInvitationHistoryItemDto,
  ResendAirlineInvitationResponseDto,
  RevokeAirlineInvitationResponseDto,
  AirlineInvitationMatrixResponseDto,
)
@Controller("airline")
@RequireUserTypes(UserType.PLATFORM)
export class AirlineInvitationController {
  constructor(
    private readonly airlineInvitationService: AirlineInvitationService,
  ) {}

  @Post("invitations")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.INVITES_ONBOARDING,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Invite airline admin",
    description: `
    Creates an airline profile and sends an invitation email to the first airline admin.
      In local/dev/test environments, the email is not sent and the onboarding link is returned in the response.
      Access: SUPER_ADMIN and STAFF with EDIT access on the INVITES_ONBOARDING asset. Requires userType=PLATFORM.
      Business logic validations (409 Conflict):
        1. airlineCode must not already exist in the airlines table
        2. companyRegistrationNumber must not already exist in the airlines table
        3. adminEmail must not already be registered as an airline user
        4. adminEmail must not have an active pending invitation
        5. airlineCode must not have an active pending invitation
        6. companyRegistrationNumber must not have an active pending invitation`,
  })
  @ApiBody({
    description: "Airline admin invitation payload",
    type: AdminInviteAirlineAdminRequestDto,
  })
  @ApiCreatedResponse({
    description: "Invitation created successfully",
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
              example: "Airline admin invitation created",
            },
            data: { $ref: getSchemaPath(AdminInviteAirlineAdminResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/airline/invitations"),
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/invitations",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  @ApiConflictResponse({
    description: "Airline code/email conflict or active invite already exists",
    schema: createConflictErrorSchema(
      "/api/v1/airline/invitations",
      "Airline code already exists",
    ),
  })
  async inviteAirlineAdmin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminInviteAirlineAdminRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AdminInviteAirlineAdminResponseDto>> {
    const response = await this.airlineInvitationService.inviteAirlineAdmin(
      req.user,
      dto,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline admin invitation created",
    );
  }

  @Get("invitations")
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.INVITES_ONBOARDING,
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get airline invitations",
    description: `
    Returns a paginated list of airline invitations across all statuses (pending, accepted, expired, revoked).
      Access: SUPER_ADMIN and STAFF with VIEW access on the INVITES_ONBOARDING asset. Requires userType=PLATFORM.
      Filters:
        1. page (pagination, min 1)
        2. limit (items per page)
        3. countryCode (ISO alpha-2)
        4. status (comma-separated values)
        5. search (email or name)`,
  })
  @ApiOkResponse({
    description: "Airline invitations fetched successfully",
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
              example: "Airline invitations fetched successfully",
            },
            data: { $ref: getSchemaPath(AirlineInvitationListResponseDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema("/api/v1/airline/invitations"),
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/invitations",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  async listInvitations(
    @Query() query: AirlineInvitationListRequestDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineInvitationListResponseDto>> {
    query.validate();
    console.log("Validated query:", query);
    const response = await this.airlineInvitationService.listInvitations(
      query,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline invitations fetched successfully",
    );
  }

  @Post("invitations/:invitationId/resend")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.INVITES_ONBOARDING,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Resend airline invitation",
    description: `
    Resends an invitation by rotating the token and extending the expiry on the existing invitation record.
      Applicable to pending, expired, and revoked invitations.
      Access: SUPER_ADMIN and STAFF with EDIT access on the INVITES_ONBOARDING asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Invitation must exist (404 if not found)
        2. Accepted invitations cannot be resent (409 Conflict)`,
  })
  @ApiOkResponse({
    description: "Invitation resent successfully",
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
              example: "Airline invitation resent successfully",
            },
            data: {
              $ref: getSchemaPath(ResendAirlineInvitationResponseDto),
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema(
      "/api/v1/airline/invitations/:invitationId/resend",
    ),
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/airline/invitations/:invitationId/resend",
      "Invitation not found",
    ),
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/invitations/:invitationId/resend",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  @ApiConflictResponse({
    description: "Accepted invitation cannot be resent",
    schema: createConflictErrorSchema(
      "/api/v1/airline/invitations/:invitationId/resend",
      "Accepted invitation cannot be resent",
    ),
  })
  async resendInvitation(
    @Req() req: AuthenticatedRequest,
    @Param("invitationId", ParseIntPipe) invitationId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<ResendAirlineInvitationResponseDto>> {
    const response = await this.airlineInvitationService.resendInvitation(
      req.user,
      invitationId,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline invitation resent successfully",
    );
  }

  @Post("invitations/:invitationId/revoke")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.INVITES_ONBOARDING,
      access: [AccessAction.EDIT],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Revoke airline invitation",
    description: `
    Revokes an existing invitation that has not yet been accepted.
      If the invitation is already revoked, the request is a no-op (returns success without re-revoking).
      Access: SUPER_ADMIN and STAFF with EDIT access on the INVITES_ONBOARDING asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Invitation must exist (404 if not found)
        2. Accepted invitations cannot be revoked (409 Conflict)`,
  })
  @ApiOkResponse({
    description: "Invitation revoked successfully",
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
              example: "Airline invitation revoked successfully",
            },
            data: {
              $ref: getSchemaPath(RevokeAirlineInvitationResponseDto),
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: "Validation failed",
    schema: createBadRequestErrorSchema(
      "/api/v1/airline/invitations/:invitationId/revoke",
    ),
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/airline/invitations/:invitationId/revoke",
      "Invitation not found",
    ),
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/invitations/:invitationId/revoke",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  @ApiConflictResponse({
    description: "Accepted invitation cannot be revoked",
    schema: createConflictErrorSchema(
      "/api/v1/airline/invitations/:invitationId/revoke",
      "Accepted invitation cannot be revoked",
    ),
  })
  async revokeInvitation(
    @Req() req: AuthenticatedRequest,
    @Param("invitationId", ParseIntPipe) invitationId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<RevokeAirlineInvitationResponseDto>> {
    const response = await this.airlineInvitationService.revokeInvitation(
      req.user,
      invitationId,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Airline invitation revoked successfully",
    );
  }

  @Get("invitations/matrix")
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.INVITES_ONBOARDING,
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get invitation matrix",
    description: `
    Returns aggregate invitation counts broken down by status: total sent, accepted, expired, revoked, and pending.
      Access: SUPER_ADMIN and STAFF with VIEW access on the INVITES_ONBOARDING asset. Requires userType=PLATFORM.`,
  })
  @ApiOkResponse({
    description: "Invitation matrix fetched successfully",
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
              example: "Invitation matrix fetched successfully",
            },
            data: { $ref: getSchemaPath(AirlineInvitationMatrixResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/invitations/matrix",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  async getInvitationMatrix(
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineInvitationMatrixResponseDto>> {
    const response =
      await this.airlineInvitationService.getInvitationMatrix(requestId);

    return BaseResponseDto.success(
      response,
      requestId,
      "Invitation matrix fetched successfully",
    );
  }

  @Get("invitations/:invitationId")
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.INVITES_ONBOARDING,
      access: [AccessAction.VIEW],
    },
  })
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get invitation by id",
    description: `
    Returns full invitation details including the complete event history.
      Each history record includes the platform admin who performed the action (null for ACCEPTED events triggered by the invitee).
      When accepted, the live airline record is used as the source of truth for airline data (meta snapshot used as fallback).
      Access: SUPER_ADMIN and STAFF with VIEW access on the INVITES_ONBOARDING asset. Requires userType=PLATFORM.
      Business logic validations:
        1. Invitation must exist (404 if not found)`,
  })
  @ApiOkResponse({
    description: "Invitation fetched successfully",
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
              example: "Invitation fetched successfully",
            },
            data: { $ref: getSchemaPath(AirlineInvitationDetailResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: "Missing/invalid access token",
    schema: createUnauthorizedErrorSchema(
      "/api/v1/airline/invitations/:invitationId",
      "Unauthorized",
    ),
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions. PLATFORM user type is required.",
  })
  @ApiNotFoundResponse({
    description: "Invitation not found",
  })
  async getInvitation(
    @Param("invitationId", ParseIntPipe) invitationId: number,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineInvitationDetailResponseDto>> {
    const response = await this.airlineInvitationService.getInvitation(
      invitationId,
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Invitation fetched successfully",
    );
  }
}
