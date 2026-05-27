import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirlineInvitationController } from "./controllers/airline-invitation.controller";
import { AirlineController } from "./controllers/airline.controller";
import { AirlineEntity } from "./entities/airline.entity";
import { AirlineUserEntity } from "./entities/airline-user.entity";
import { AirlineInvitationService } from "./services/airline-invitation.service";
import { AirlineService } from "./services/airline.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([AirlineEntity, AirlineUserEntity]),
  ],
  controllers: [AirlineController, AirlineInvitationController],
  providers: [AirlineService, AirlineInvitationService],
})
export class AirlineModule {}
