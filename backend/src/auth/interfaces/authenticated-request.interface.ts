import { Request } from "express";
import {
  AdminRole,
  AirlineRole,
  UserType,
} from "../../common/constants/user.constants";
import { UserAccessControlEntry } from "../../common/constants/access-control.constants";
import { Logger } from "winston";

// backend request contain requestId, logger,
export type BackendRequest = Request & {
  requestId: string;
  logger: Logger;
};

export type AuthenticatedRequest = BackendRequest & {
  user: AuthenticatedUser;
};

export interface AuthenticatedUser {
  sub: number;
  email: string;
  role: AdminRole | AirlineRole;
  userType: UserType;
  airlineId?: number;
  accessControls: UserAccessControlEntry[];
}
