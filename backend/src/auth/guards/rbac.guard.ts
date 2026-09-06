import {
  BadRequestException,
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
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "../interfaces/authenticated-request.interface";
import {
  AccessControlRequirement,
  isBypassRole,
  hasRequiredAccess,
} from "../../common/constants/access-control.constants";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
    const requestLogger = request.logger;
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    const userType = user.userType as UserType;
    const userRole = user.role as AdminRole | AirlineRole;
    if (!userType) {
      requestLogger.error("User Type is missing");
      throw new ForbiddenException("Access denied");
    }

    if (requiredUserTypes && requiredUserTypes.length > 0) {
      if (!requiredUserTypes.includes(userType)) {
        requestLogger.error(
          "User Type is not included in the required user types",
        );
        throw new ForbiddenException("Access denied");
      }
      // If user type is specified in requirements, but role is missing, deny access
      if (userType === UserType.PLATFORM) {
        if (requiredUserTypes.includes(UserType.PLATFORM)) {
          const userHasAdminRole = Object.values(AdminRole).includes(
            userRole as AdminRole,
          );
          if (!userHasAdminRole) {
            requestLogger.error("User does not have the required admin role");
            throw new ForbiddenException("Access denied");
          }
        } else {
          requestLogger.error(
            "User type is PLATFORM but not included in required user types",
          );
          throw new ForbiddenException("Access denied");
        }
      } else {
        if (requiredUserTypes.includes(UserType.AIRLINE)) {
          const userHasAirlineRole = Object.values(AirlineRole).includes(
            userRole as AirlineRole,
          );
          if (!userHasAirlineRole) {
            requestLogger.error("User does not have the required airline role");
            throw new ForbiddenException("Access denied");
          }
        } else {
          requestLogger.error(
            "User type is AIRLINE but not included in required user types",
          );
          throw new ForbiddenException("Access denied");
        }
      }
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(userRole)) {
        requestLogger.error("User role is not included in the required roles");
        throw new ForbiddenException("Access denied");
      }
    }

    if (requiredAccessControl) {
      if (isBypassRole(userType, userRole)) {
        return true;
      }

      const domainRequirement =
        userType === UserType.PLATFORM
          ? requiredAccessControl.platform
          : requiredAccessControl.airline;

      if (!domainRequirement) {
        requestLogger.error("Domain requirement is missing");
        throw new ForbiddenException("Access denied");
      }

      if (
        !hasRequiredAccess(
          userType,
          userRole,
          domainRequirement,
          user.accessControls,
        )
      ) {
        requestLogger.error("User does not have the required access");
        throw new ForbiddenException("Access denied");
      }
    }
    return true;
  }
}
