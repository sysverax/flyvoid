import { SetMetadata } from "@nestjs/common";
import {
  AdminRole,
  AirlineRole,
  UserType,
} from "../../common/constants/user.constants";
import { AccessControlRequirement } from "../../common/constants/access-control.constants";

export const RBAC_USER_TYPES_KEY = "rbac_user_types";
export const RBAC_ROLES_KEY = "rbac_roles";
export const RBAC_ACCESS_CONTROL_KEY = "rbac_access_control";

export type UserRoleRequirement = AdminRole | AirlineRole;

export const RequireUserTypes = (...userTypes: UserType[]) =>
  SetMetadata(RBAC_USER_TYPES_KEY, userTypes);

export const RequireUserRoles = (...roles: UserRoleRequirement[]) =>
  SetMetadata(RBAC_ROLES_KEY, roles);

export const RequireAccessControl = (rule: AccessControlRequirement) =>
  SetMetadata(RBAC_ACCESS_CONTROL_KEY, rule);
