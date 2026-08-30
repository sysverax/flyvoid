import { ApiProperty } from "@nestjs/swagger";

export class UpdateAirlineAirportsResponseDto {
  @ApiProperty({ example: 12 })
  airlineId!: number;

  @ApiProperty({
    description: "Airport ids that were activated in this request",
    example: [1, 3, 5],
    type: Number,
    isArray: true,
  })
  assignedAirportIds!: number[];

  @ApiProperty({
    description: "Airport ids that were disabled in this request",
    example: [2, 4],
    type: Number,
    isArray: true,
  })
  disabledAirportIds!: number[];
}
