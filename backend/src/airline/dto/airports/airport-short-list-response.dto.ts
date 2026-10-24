import { ApiProperty } from "@nestjs/swagger";
import { PaginationMeta } from "../../../common/dto/pagination-query.dto";

/** An airport as returned with shorten=true (for dropdowns). */
export class AirportShortResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "Dubai International Airport" })
  name!: string;

  @ApiProperty({ example: "DXB" })
  iataCode!: string;
}

export class AirportShortListResponseDto implements PaginationMeta {
  @ApiProperty({
    description: "Paginated list of airports (id, name and IATA code only)",
    type: AirportShortResponseDto,
    isArray: true,
  })
  airports!: AirportShortResponseDto[];

  @ApiProperty({
    description: "Total airports matching current filters",
    example: 42,
  })
  total!: number;

  @ApiProperty({ description: "Current page number", example: 1 })
  currentPage!: number;

  @ApiProperty({ description: "Total number of pages", example: 1 })
  totalPages!: number;

  @ApiProperty({ description: "Number of records per page", example: 200 })
  limit!: number;
}
