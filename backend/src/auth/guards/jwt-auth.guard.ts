import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import {
  AdminRole,
  AirlineRole,
  UserType,
} from "../../common/constants/user.constants";
import { JwtAccessPayload } from "../interfaces/jwt-access-payload.interface";
import { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";
import { AuthRepository } from "../repositories/auth.repository";
import { Logger } from "winston";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private authRepository: AuthRepository) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isValid = await super.canActivate(context);
    if (!isValid) return false;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requestId = request.requestId;
    const logger: Logger = request.logger;
    const tokenUser = request.user as JwtAccessPayload;

    if (!tokenUser.userType) {
      throw new ForbiddenException("Access denied");
    }

    const userType = tokenUser.userType;

    if (userType === UserType.PLATFORM) {
      const [admin, accessControls] = await Promise.all([
        this.authRepository.findAdminById(tokenUser.sub, logger),
        this.authRepository.findPlatformAccessControlsByAdminId(
          tokenUser.sub,
          logger,
        ),
      ]);

      if (!admin) {
        throw new UnauthorizedException("Unauthorized");
      }

      if (!admin.isActive) {
        throw new ForbiddenException("Access denied");
      }

      if (!accessControls) {
        throw new InternalServerErrorException(
          "Failed to retrieve access controls",
        );
      }

      request.user = {
        ...tokenUser,
        email: admin.email,
        role: admin.role,
        userType: UserType.PLATFORM,
        accessControls: accessControls,
      };
    } else if (userType === UserType.AIRLINE) {
      const [airlineUser, accessControls] = await Promise.all([
        this.authRepository.findAirlineUserById(tokenUser.sub, requestId),
        this.authRepository.findAirlineAccessControlsByAirlineUserId(
          tokenUser.sub,
          requestId,
        ),
      ]);

      if (!airlineUser) {
        throw new UnauthorizedException("Unauthorized");
      }

      if (!airlineUser.isActive) {
        throw new ForbiddenException("Access denied");
      }

      if (!accessControls) {
        throw new InternalServerErrorException(
          "Failed to retrieve access controls",
        );
      }

      const airline = await this.authRepository.findAirlineById(
        airlineUser.airlineId,
        requestId,
      );

      if (!airline) {
        throw new ForbiddenException("Access denied");
      }

      if (!airline.isActive) {
        throw new ForbiddenException("Access denied");
      }

      request.user = {
        ...tokenUser,
        email: airlineUser.email,
        role: airlineUser.role,
        userType: UserType.AIRLINE,
        airlineId: airlineUser.airlineId,
        accessControls: accessControls,
      };
    } else {
      throw new ForbiddenException("Access denied");
    }

    return true;
  }

  private getRequestId(request: any): string {
    const headerRequestId = request.headers?.["x-request-id"];
    if (
      typeof headerRequestId === "string" &&
      headerRequestId.trim().length > 0
    ) {
      return headerRequestId;
    }

    return "jwt-auth-guard";
  }
}
