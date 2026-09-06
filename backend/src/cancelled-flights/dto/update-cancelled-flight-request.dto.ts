import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { CancellationReason } from "../entities/enums";

export class UpdateCancelledFlightDto {
  @ApiPropertyOptional({ example: "SW1234" })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  departureAirportId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  arrivalAirportId?: number;

  @ApiPropertyOptional({ example: "2024-01-15" })
  @IsOptional()
  @IsDateString()
  cancellationDate?: string;

  @ApiPropertyOptional({ enum: CancellationReason })
  @IsOptional()
  @IsEnum(CancellationReason)
  cancellationReason?: CancellationReason;

  @ApiPropertyOptional({ example: "Severe weather conditions at departure" })
  @IsOptional()
  @IsString()
  cancellationReasonText?: string;
}
