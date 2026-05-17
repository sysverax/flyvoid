import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthRepository } from "../repositories/auth.repository";
import {
  AdminRole,
  AirlineRole,
  UserType,
} from "../../common/constants/user.constants";
import {
  RBAC_ACCESS_CONTROL_KEY,
  RBAC_ROLES_KEY,
  RBAC_USER_TYPES_KEY,
  UserRoleRequirement,
} from "../decorators/rbac.decorator";
import { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";
import {
  AccessControlRequirement,
  isBypassRole,
  hasRequiredAccess,
} from "../../common/constants/access-control.constants";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authRepository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredUserTypes = this.reflector.getAllAndOverride<UserType[]>(
      RBAC_USER_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRoles = this.reflector.getAllAndOverride<
      UserRoleRequirement[]
    >(RBAC_ROLES_KEY, [context.getHandler(), context.getClass()]);

    const requiredAccessControl =
      this.reflector.getAllAndOverride<AccessControlRequirement>(
        RBAC_ACCESS_CONTROL_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (
      (!requiredUserTypes || requiredUserTypes.length === 0) &&
      (!requiredRoles || requiredRoles.length === 0) &&
      !requiredAccessControl
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    const requestId = this.getRequestId(request);

    const hydratedUser = await this.hydrateAndValidateUser(request, requestId);
    request.user = hydratedUser;

    const userType = hydratedUser.userType;
    if (!userType) {
      throw new ForbiddenException("Access denied");
    }

    if (requiredUserTypes && requiredUserTypes.length > 0) {
      if (!requiredUserTypes.includes(userType)) {
        throw new ForbiddenException("Access denied");
      }
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (
        !requiredRoles.includes(hydratedUser.role as AdminRole | AirlineRole)
      ) {
        throw new ForbiddenException("Access denied");
      }
    }

    this.validateAirlineTenantBoundary(request, userType);

    if (requiredAccessControl) {
      if (
        isBypassRole(userType, hydratedUser.role as AdminRole | AirlineRole)
      ) {
        return true;
      }

      const domainRequirement =
        userType === UserType.PLATFORM
          ? requiredAccessControl.platform
          : requiredAccessControl.airline;

      if (!domainRequirement) {
        throw new ForbiddenException("Access denied");
      }

      if (
        !hasRequiredAccess(
          userType,
          hydratedUser.role as AdminRole | AirlineRole,
          domainRequirement,
          hydratedUser.accessControls,
        )
      ) {
        throw new ForbiddenException("Access denied");
      }
    }

    return true;
  }

  private validateAirlineTenantBoundary(
    request: AuthenticatedRequest,
    userType: UserType,
  ): void {
    if (userType !== UserType.AIRLINE) {
      return;
    }

    const userAirlineId = request.user?.airlineId;
    if (!userAirlineId) {
      throw new ForbiddenException("Access denied");
    }

    const rawAirlineId =
      (request.params?.airlineId as string | undefined) ??
      (request.body?.airlineId as number | string | undefined) ??
      (request.query?.airlineId as string | undefined);

    if (
      rawAirlineId === undefined ||
      rawAirlineId === null ||
      rawAirlineId === ""
    ) {
      return;
    }

    const requestedAirlineId = Number(rawAirlineId);
    if (
      !Number.isFinite(requestedAirlineId) ||
      requestedAirlineId !== userAirlineId
    ) {
      throw new ForbiddenException("Access denied");
    }
  }

  private getRequestId(request: AuthenticatedRequest): string {
    const headerRequestId = request.headers?.["x-request-id"];
    if (
      typeof headerRequestId === "string" &&
      headerRequestId.trim().length > 0
    ) {
      return headerRequestId;
    }

    return "rbac-guard";
  }

  private async hydrateAndValidateUser(
    request: AuthenticatedRequest,
    requestId: string,
  ): Promise<AuthenticatedRequest["user"]> {
    const tokenUser = request.user;

    if (!tokenUser.userType) {
      throw new ForbiddenException("Access denied");
    }

    if (tokenUser.userType === UserType.PLATFORM) {
      const admin = await this.authRepository.findAdminById(
        tokenUser.sub,
        requestId,
      );
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException("Unauthorized");
      }

      const accessControls =
        admin.role === AdminRole.SUPER_ADMIN
          ? undefined
          : await this.authRepository.findPlatformAccessControlsByAdminId(
              admin.id,
              requestId,
            );

      return {
        ...tokenUser,
        email: admin.email,
        role: admin.role,
        userType: UserType.PLATFORM,
        accessControls,
      };
    }

    const airlineUser = await this.authRepository.findAirlineUserById(
      tokenUser.sub,
      requestId,
    );

    if (!airlineUser || !airlineUser.isActive) {
      throw new UnauthorizedException("Unauthorized");
    }

    const airline = await this.authRepository.findAirlineById(
      airlineUser.airlineId,
      requestId,
    );

    if (!airline || !airline.isActive) {
      throw new ForbiddenException("Access denied");
    }

    const accessControls =
      airlineUser.role === AirlineRole.AIRLINE_ADMIN
        ? undefined
        : await this.authRepository.findAirlineAccessControlsByAirlineUserId(
            airlineUser.id,
            requestId,
          );

    return {
      ...tokenUser,
      email: airlineUser.email,
      role: airlineUser.role,
      userType: UserType.AIRLINE,
      airlineId: airlineUser.airlineId,
      accessControls,
    };
  }
}
