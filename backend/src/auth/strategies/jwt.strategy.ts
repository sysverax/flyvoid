import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { config } from "../../config/config";
import { JwtAccessPayload } from "../interfaces/jwt-access-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  validate(payload: JwtAccessPayload): JwtAccessPayload {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid access token");
    }

    return payload;
  }
}
