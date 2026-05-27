import {
  Body,
  Controller,
  HttpCode,
  Post,
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
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../../auth/guards/rbac.guard";
import { AuthenticatedRequest } from "../../auth/interfaces/authenticated-request.interface";
import { AirlineInvitationService } from "../services/airline-invitation.service";

@ApiTags("Airline")
@ApiExtraModels(
  BaseResponseDto,
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
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
}
