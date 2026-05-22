import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminEntity } from "../admin/entities/admin.entity";
import { AuthModule } from "../auth/auth.module";
import { AirportController } from "./controllers/airport.controller";
import { AirportEntity } from "./entities/airport.entity";
import { AirportService } from "./services/airport.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([AirportEntity, AdminEntity])],
  controllers: [AirportController],
  providers: [AirportService],
})
export class AirportModule {}
