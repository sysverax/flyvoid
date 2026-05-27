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
  createUnauthorizedErrorSchema,
} from "../../common/constants/swagger.constants";
import { UserType } from "../../common/constants/user.constants";
import { RequestId } from "../../common/decorators/request-id.decorator";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import { RequireUserTypes } from "../../auth/decorators/rbac.decorator";
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
} from "../dto";
import { AirlineInvitationService } from "../services/airline-invitation.service";

@ApiTags("Airline Invitations")
@ApiExtraModels(
  BaseResponseDto,
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
  AirlineInvitationListResponseDto,
  ResendAirlineInvitationResponseDto,
  RevokeAirlineInvitationResponseDto,
  AirlineInvitationMatrixResponseDto,
)
@Controller("airline")
export class AirlineInvitationController {
  constructor(
    private readonly airlineInvitationService: AirlineInvitationService,
  ) {}

  @Post("invitations")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Invite airline admin",
    description:
      "Platform admin creates an airline and invites its first airline admin using email. In local/dev/test, email is not sent and onboarding link is returned in response. Requires userType=PLATFORM.",
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
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get airline invitations",
    description:
      "Returns paginated airline invitations including accepted, pending, expired, and revoked states. Requires userType=PLATFORM.",
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
    @Query() pagination: PaginationQueryDto,
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<AirlineInvitationListResponseDto>> {
    const response = await this.airlineInvitationService.listInvitations(
      pagination,
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
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Resend airline invitation",
    description:
      "Resends invitation for pending, expired, or revoked invitations by rotating token and expiry on the same invitation record. Requires userType=PLATFORM.",
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
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Revoke airline invitation",
    description:
      "Revokes an existing invitation that is not yet accepted. Requires userType=PLATFORM.",
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
  @RequireUserTypes(UserType.PLATFORM)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Get invitation matrix",
    description:
      "Returns invitation matrix summary with total sent, accepted, expired, revoked, and pending counts. Requires userType=PLATFORM.",
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
    const response = await this.airlineInvitationService.getInvitationMatrix(
      requestId,
    );

    return BaseResponseDto.success(
      response,
      requestId,
      "Invitation matrix fetched successfully",
    );
  }
}
