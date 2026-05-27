import { BadRequestException } from "@nestjs/common";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsInt, IsOptional, Min } from "class-validator";

export class UpdateAirlineAirportsRequestDto {
  @ApiPropertyOptional({
    description: "Airport ids to assign/enable for the airline",
    example: [1, 3, 5],
    type: Number,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  assignAirportIds?: number[];

  @ApiPropertyOptional({
    description: "Airport ids to disable for the airline",
    example: [2, 4],
    type: Number,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  disableAirportIds?: number[];

  static validatePayload(dto: UpdateAirlineAirportsRequestDto): void {
    const assignAirportIds = dto.assignAirportIds ?? [];
    const disableAirportIds = dto.disableAirportIds ?? [];

    if (assignAirportIds.length === 0 && disableAirportIds.length === 0) {
      throw new BadRequestException(
        "At least one of assignAirportIds or disableAirportIds must be provided",
      );
    }

    const disableSet = new Set(disableAirportIds);
    const overlap = assignAirportIds.filter((id) => disableSet.has(id));
    if (overlap.length > 0) {
      throw new BadRequestException(
        `airport ids cannot be both assigned and disabled in the same request: ${overlap.join(", ")}`,
      );
    }
  }
}
