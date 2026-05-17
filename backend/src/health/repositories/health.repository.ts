import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoggerService } from "../../common/logger/logger.service";
import { HealthLogEntity } from "../entities/health-log.entity";

@Injectable()
export class HealthRepository {
  constructor(
    @InjectRepository(HealthLogEntity)
    private readonly healthLogRepository: Repository<HealthLogEntity>,
    private readonly logger: LoggerService,
  ) {}

  async saveHealthLog(
    status: string,
    uptimeSeconds: number,
    requestId: string,
  ): Promise<HealthLogEntity> {
    this.logger.debug(
      "Saving health log entry",
      "HealthRepository",
      requestId,
      {
        status,
        uptimeSeconds,
      },
    );

    const entity = this.healthLogRepository.create({
      status,
      uptimeSeconds,
    });

    const saved = await this.healthLogRepository.save(entity);

    this.logger.debug("Health log entry saved", "HealthRepository", requestId, {
      id: saved.id,
    });

    return saved;
  }

  async getLatestLog(requestId: string): Promise<HealthLogEntity | null> {
    this.logger.debug(
      "Fetching latest health log entry",
      "HealthRepository",
      requestId,
    );

    return this.healthLogRepository.findOne({
      order: {
        checkedAt: "DESC",
      },
    });
  }
}
