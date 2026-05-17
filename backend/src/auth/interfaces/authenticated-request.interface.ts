import { Request } from "express";
import { JwtAccessPayload } from "./jwt-access-payload.interface";

export type AuthenticatedRequest = Request & {
  requestId?: string;
  user: JwtAccessPayload;
};
