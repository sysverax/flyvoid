import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirlineInvitationController } from "./controllers/airline-invitation.controller";
import { AirlineUserController } from "./controllers/airline-user.controller";
import { AirlineController } from "./controllers/airline.controller";
import { AirlineEntity } from "./entities/airline.entity";
import { AirlineUserEntity } from "./entities/airline-user.entity";
import { AirlineInvitationService } from "./services/airline-invitation.service";
import { AirlineUserService } from "./services/airline-user.service";
import { AirlineService } from "./services/airline.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([AirlineEntity, AirlineUserEntity]),
  ],
  controllers: [
    AirlineUserController,
    AirlineInvitationController,
    AirlineController,
  ],
  providers: [AirlineUserService, AirlineInvitationService, AirlineService],
})
export class AirlineModule {}
