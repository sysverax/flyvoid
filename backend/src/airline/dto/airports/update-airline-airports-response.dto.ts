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

  @ApiProperty({
    description: "Final active airport ids currently assigned to the airline",
    example: [1, 3, 7],
    type: Number,
    isArray: true,
  })
  activeAirportIds!: number[];

  @ApiProperty({
    description: "Total active airport assignments after the update",
    example: 3,
  })
  totalActiveAirports!: number;
}
