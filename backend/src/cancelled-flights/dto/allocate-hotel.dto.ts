import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class AllocateHotelDto {
  @ApiProperty({ example: "Grand Horizon Luxury & Suites" })
  @IsNotEmpty()
  @IsString()
  hotelName!: string;

  @ApiPropertyOptional({ example: "100 Airport Boulevard, near LAX Airport" })
  @IsOptional()
  @IsString()
  hotelAddress?: string;

  @ApiProperty({ example: "2025-02-15" })
  @IsNotEmpty()
  @IsString()
  checkInDate!: string;

  @ApiProperty({ example: "2025-02-16" })
  @IsNotEmpty()
  @IsString()
  checkOutDate!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalRooms?: number;

  @ApiPropertyOptional({ example: 175.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerRoom?: number;
}
