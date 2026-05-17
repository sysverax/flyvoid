import { ApiProperty } from "@nestjs/swagger";

export class AirlineProfileResponseDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: "SkyJet Airways" })
  name!: string;

  @ApiProperty({ example: "SKYJET" })
  code!: string;

  @ApiProperty({ example: "AE" })
  countryCode!: string;

  @ApiProperty({ example: "ops@skyjet.com", nullable: true })
  contactEmail?: string | null;

  @ApiProperty({ example: "+971501112233", nullable: true })
  contactPhone?: string | null;
}
