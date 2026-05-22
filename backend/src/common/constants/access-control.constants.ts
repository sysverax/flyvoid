import { AdminRole, AirlineRole, UserType } from "./user.constants";

export enum PlatformAsset {
  DASHBOARD = "DASHBOARD",
  AIRLINES = "AIRLINES",
  AIRPORTS = "AIRPORTS",
  CANCELLED_FLIGHTS = "CANCELLED_FLIGHTS",
  REVENUE = "REVENUE",
  PAYMENTS = "PAYMENTS",
  INVITES_ONBOARDING = "INVITES_ONBOARDING",
  SYSTEM_SETTINGS = "SYSTEM_SETTINGS",
  AUDIT_LOGS = "AUDIT_LOGS",
  PROFILE = "PROFILE",
  ADMIN_USERS = "ADMIN_USERS",
}

export enum AirlineAsset {
  DASHBOARD = "DASHBOARD",
  AIRPORTS = "AIRPORTS",
  CANCELLED_FLIGHTS = "CANCELLED_FLIGHTS",
  BOOKINGS = "BOOKINGS",
  PAYMENTS = "PAYMENTS",
  SETTINGS = "SETTINGS",
  AIRLINE = "AIRLINE",
  PROFILE = "PROFILE",
  AIRLINE_USERS = "AIRLINE_USERS",
}

export enum AccessAction {
  VIEW = "VIEW",
  EDIT = "EDIT",
  DELETE = "DELETE",
  EXPORT = "EXPORT",
}

export interface DomainAccessRequirement {
  asset: string;
  access: AccessAction[];
}

export interface AccessControlRequirement {
  platform?: DomainAccessRequirement;
  airline?: DomainAccessRequirement;
}

export interface UserAccessControlEntry {
  moduleKey: string;
  permissions: AccessAction[];
}

export function isBypassRole(
  userType: UserType,
  role: AdminRole | AirlineRole,
): boolean {
  if (userType === UserType.PLATFORM) {
    return role === AdminRole.SUPER_ADMIN;
  }

  return role === AirlineRole.AIRLINE_ADMIN;
}

export function hasRequiredAccess(
  userType: UserType,
  role: AdminRole | AirlineRole,
  requirement: DomainAccessRequirement,
  assignedAccessControls?: UserAccessControlEntry[],
): boolean {
  if (isBypassRole(userType, role)) {
    return true;
  }

  const assignedPermissions =
    assignedAccessControls?.find(
      (entry) => entry.moduleKey === requirement.asset,
    )?.permissions ?? [];

  const assignedPermissionSet = new Set(assignedPermissions);

  return requirement.access.every((permission) =>
    assignedPermissionSet.has(permission),
  );
}
