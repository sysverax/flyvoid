import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LoggerService } from "../../common/logger/logger.service";
import { HealthResponseDto } from "../dto/health-response.dto";
import { HealthRepository } from "../repositories/health.repository";

@Injectable()
export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    private readonly logger: LoggerService,
  ) {}

  async checkHealth(requestId: string): Promise<HealthResponseDto> {
    const context = "HealthService";

    try {
      const uptimeSeconds = Math.floor(process.uptime());
      const status = "ok";
      const timestamp = new Date().toISOString();

      await this.healthRepository.saveHealthLog(
        status,
        uptimeSeconds,
        requestId,
      );

      this.logger.info("Health check completed", context, requestId, {
        status,
        uptimeSeconds,
      });

      return {
        status,
        timestamp,
        uptimeSeconds,
        version: "1.0.0",
      };
    } catch (error) {
      this.logger.error("Failed to process health check", context, requestId, {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: "Unknown error" },
      });

      throw new InternalServerErrorException("Failed to perform health check");
    }
  }
}
