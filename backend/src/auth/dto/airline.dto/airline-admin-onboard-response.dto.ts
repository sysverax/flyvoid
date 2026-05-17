import { ApiProperty } from "@nestjs/swagger";

export class AirlineAdminOnboardResponseDto {
  @ApiProperty({
    description: "Airline user id",
    example: 201,
  })
  userId!: number;

  @ApiProperty({
    description: "Airline id",
    example: 12,
  })
  airlineId!: number;

  @ApiProperty({
    description: "Airline admin email",
    example: "aisha.khan@skyjet.com",
  })
  email!: string;
}
