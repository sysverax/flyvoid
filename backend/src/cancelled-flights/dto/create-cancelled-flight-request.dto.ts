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
  flightNumber!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  airlineId!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  departureAirportId!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  arrivalAirportId!: number;

  @ApiProperty({ example: "2024-01-15" })
  @IsDateString()
  cancellationDate!: string;

  @ApiPropertyOptional({ enum: CancellationReason })
  @IsOptional()
  @IsEnum(CancellationReason)
  cancellationReason?: CancellationReason;

  @ApiPropertyOptional({ example: "Severe weather conditions at departure" })
  @IsOptional()
  @IsString()
  cancellationReasonText?: string;
}
