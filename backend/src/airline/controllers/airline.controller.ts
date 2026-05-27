import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
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
  AirlineUserProfileResponseDto,
} from "../dto";
import { AirlineService } from "../services/airline.service";

@ApiTags("Airline")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.AIRLINE)
@Controller("airline")
export class AirlineController {
  constructor(private readonly airlineService: AirlineService) {}

  @Get("user/profile")
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
    const response = await this.airlineService.getUserProfile(
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
    const response = await this.airlineService.getAirlineProfile(
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
