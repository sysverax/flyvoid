import { ApiProperty } from "@nestjs/swagger";
import { AirlineUserResponseDto } from "./airline-user-response.dto";

export class AirlineUserListResponseDto {
  @ApiProperty({ description: "Total number of airline users", example: 8 })
  total!: number;

  @ApiProperty({ description: "Current page number", example: 1 })
  currentPage!: number;

  @ApiProperty({
    description: "Maximum records returned per page",
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: "Paginated airline users",
    type: AirlineUserResponseDto,
    isArray: true,
  })
  users!: AirlineUserResponseDto[];
}
