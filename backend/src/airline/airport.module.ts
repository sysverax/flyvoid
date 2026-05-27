import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminEntity } from "../admin/entities/admin.entity";
import { AuthModule } from "../auth/auth.module";
import { AirportController } from "./controllers/airport.controller";
import { AirlineAirportEntity } from "./entities/airline-airport.entity";
import { AirlineEntity } from "./entities/airline.entity";
import { AirportEntity } from "./entities/airport.entity";
import { AirlineAirportRepository } from "./repositories/airline-airport.repository";
import { AirportRepository } from "./repositories/airport.repository";
import { AirportService } from "./services/airport.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AirportEntity,
      AirlineEntity,
      AirlineAirportEntity,
      AdminEntity,
    ]),
  ],
  controllers: [AirportController],
  providers: [AirportRepository, AirlineAirportRepository, AirportService],
})
export class AirportModule {}
