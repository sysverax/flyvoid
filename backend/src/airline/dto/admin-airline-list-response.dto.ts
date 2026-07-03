import { ApiProperty } from "@nestjs/swagger";
import { AdminAirlineResponseDto } from "./admin-airline-response.dto";

export class AdminAirlineListResponseDto {
  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ type: AdminAirlineResponseDto, isArray: true })
  airlines!: AdminAirlineResponseDto[];
}
