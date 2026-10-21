import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";
import { AirlineDashboardController } from "./airline-dashboard.controller";
import { AirlineDashboardRepository } from "./airline-dashboard.repository";
import { AirlineDashboardService } from "./airline-dashboard.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([CancelledFlightEntity])],
  controllers: [AirlineDashboardController],
  providers: [AirlineDashboardService, AirlineDashboardRepository],
})
export class DashboardModule {}
