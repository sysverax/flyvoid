import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { CancellationReason } from "../entities/enums";

export class CreateCancelledFlightDto {
  @ApiProperty({ example: "SW1234" })
  @IsNotEmpty()
  @IsString()
  flight_number!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  airline_id!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  departure_airport_id!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  arrival_airport_id!: number;

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  cancellation_date!: string;

  @ApiPropertyOptional({ enum: CancellationReason })
  @IsOptional()
  @IsEnum(CancellationReason)
  cancellation_reason?: CancellationReason;

  @ApiPropertyOptional({ example: "Severe weather conditions at departure" })
  @IsOptional()
  @IsString()
  cancellation_reason_text?: string;
}
