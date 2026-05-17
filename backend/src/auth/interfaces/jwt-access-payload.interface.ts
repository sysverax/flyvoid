import {
  AdminRole,
  AirlineRole,
  UserType,
} from "../../common/constants/user.constants";
import { UserAccessControlEntry } from "../../common/constants/access-control.constants";

export interface JwtAccessPayload {
  sub: number;
  email: string;
  role: AdminRole | AirlineRole;
  userType?: UserType;
  airlineId?: number;
  accessControls?: UserAccessControlEntry[];
  type: "access";
}
