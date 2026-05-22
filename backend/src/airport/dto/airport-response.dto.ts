import { ApiProperty } from "@nestjs/swagger";
import { AirportType } from "../entities/airport.entity";

export class AirportResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "Dubai International Airport" })
  name!: string;

  @ApiProperty({ example: "DXB" })
  iataCode!: string;

  @ApiProperty({ example: "OMDB" })
  icaoCode!: string;

  @ApiProperty({ example: "AE" })
  countryCode!: string;

  @ApiProperty({ example: "Dubai" })
  city!: string;

  @ApiProperty({ example: 25.2532 })
  latitude!: number;

  @ApiProperty({ example: 55.3657 })
  longitude!: number;

  @ApiProperty({ example: "Asia/Dubai" })
  timezone!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ enum: AirportType, example: AirportType.INTERNATIONAL })
  type!: AirportType;

  @ApiProperty({ example: "Airport Road", nullable: true })
  address!: string | null;

  @ApiProperty({ example: "00000", })
  postalCode!: string | null;

  @ApiProperty({ example: 2 })
  createdBy!: number;

  @ApiProperty({ example: 2, nullable: true })
  updatedBy!: number | null;

  @ApiProperty({ example: "2026-05-22T11:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-22T11:00:00.000Z" })
  updatedAt!: string;
}
