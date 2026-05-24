import { ApiProperty } from "@nestjs/swagger";
import { AirportResponseDto } from "./airport-response.dto";
import { PaginationMeta } from "../../common/dto/pagination-query.dto";

export class AirportListResponseDto implements PaginationMeta {
  @ApiProperty({
    description: "Paginated list of airports",
    type: AirportResponseDto,
    isArray: true,
  })
  airports!: AirportResponseDto[];

  @ApiProperty({
    description: "Total airports matching current filters",
    example: 42,
  })
  total!: number;

  @ApiProperty({ description: "Current page number", example: 2 })
  currentPage!: number;

  @ApiProperty({ description: "Total number of pages", example: 5 })
  totalPages!: number;

  @ApiProperty({ description: "Number of records per page", example: 20 })
  limit!: number;
}
