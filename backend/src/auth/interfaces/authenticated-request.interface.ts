import { Request } from "express";
import { JwtAccessPayload } from "./jwt-access-payload.interface";
import {
  AdminRole,
  AirlineRole,
  UserType,
} from "../../common/constants/user.constants";
import { UserAccessControlEntry } from "../../common/constants/access-control.constants";

export type AuthenticatedRequest = Request & {
  requestId?: string;
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
