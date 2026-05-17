import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./controllers/health.controller";
import { HealthLogEntity } from "./entities/health-log.entity";
import { HealthRepository } from "./repositories/health.repository";
import { HealthService } from "./services/health.service";

@Module({
  imports: [TypeOrmModule.forFeature([HealthLogEntity])],
  controllers: [HealthController],
  providers: [HealthService, HealthRepository],
  exports: [HealthService],
})
export class HealthModule {}
