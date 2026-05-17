import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BaseResponseDto } from "../../common/dto/base-response.dto";
import { RequestId } from "../../common/decorators/request-id.decorator";
import { HealthResponseDto } from "../dto/health-response.dto";
import { HealthService } from "../services/health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Get backend health status" })
  @ApiOkResponse({
    description: "Health check successful",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        requestId: {
          type: "string",
          example: "0b6c7c87-57d7-4b8f-92eb-4b3442784b3b",
        },
        timestamp: { type: "string", example: "2026-01-01T10:00:00.000Z" },
        message: { type: "string", example: "Health check successful" },
        data: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            timestamp: { type: "string", example: "2026-01-01T10:00:00.000Z" },
            uptimeSeconds: { type: "number", example: 125 },
            version: { type: "string", example: "1.0.0" },
          },
        },
      },
    },
  })
  async getHealth(
    @RequestId() requestId: string,
  ): Promise<BaseResponseDto<HealthResponseDto>> {
    const health = await this.healthService.checkHealth(requestId);
    return BaseResponseDto.success(
      health,
      requestId,
      "Health check successful",
    );
  }
}
