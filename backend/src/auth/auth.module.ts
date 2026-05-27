import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminEntity } from "../admin/entities/admin.entity";
import { PlatformAccessControlEntity } from "../admin/entities/platform-access-control.entity";
import { AirlineAdminInviteEntity } from "../airline/entities/airline-admin-invite.entity";
import { AirlineAdminInviteHistoryEntity } from "../airline/entities/airline-admin-invite-history.entity";
import { MetaAirlineInviteEntity } from "../airline/entities/meta-airline-invite.entity";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirlineAccessControlEntity } from "../airline/entities/airline-access-control.entity";
import { AirlineUserEntity } from "../airline/entities/airline-user.entity";
import { AirlineAuthController } from "./controllers/airline-auth.controller";
import { AuthController } from "./controllers/admin-auth.controller";
import { AirlinePasswordResetOtpEntity } from "./entities/airline-password-reset-otp.entity";
import { AirlineRefreshTokenEntity } from "./entities/airline-refresh-token.entity";
import { AdminPasswordResetOtpEntity } from "./entities/admin-password-reset-otp.entity";
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { RbacGuard } from "./guards/rbac.guard";
import { AirlineInvitationRepository } from "../airline/repositories/airline-invitation.repository";
import { AuthRepository } from "./repositories/auth.repository";
import { AirlineAuthService } from "./services/airline-auth.service";
import { AuthService } from "./services/admin-auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminEntity,
      AirlineEntity,
      AirlineUserEntity,
      RefreshTokenEntity,
      AirlineRefreshTokenEntity,
      AdminPasswordResetOtpEntity,
      AirlinePasswordResetOtpEntity,
      AirlineAdminInviteEntity,
      AirlineAdminInviteHistoryEntity,
      MetaAirlineInviteEntity,
      PlatformAccessControlEntity,
      AirlineAccessControlEntity,
    ]),
    JwtModule.register({}),
    PassportModule,
  ],
  controllers: [AuthController, AirlineAuthController],
  providers: [
    AuthService,
    AirlineAuthService,
    AuthRepository,
    AirlineInvitationRepository,
    JwtStrategy,
    RbacGuard,
  ],
  exports: [
    JwtStrategy,
    PassportModule,
    RbacGuard,
    AuthRepository,
    AuthService,
    AirlineInvitationRepository,
  ],
})
export class AuthModule {}
