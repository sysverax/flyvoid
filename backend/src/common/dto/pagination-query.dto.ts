import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { parseStrictPositiveInt } from "../../common/validator/number.validator";

export interface PaginationMeta {
  total: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Page number (1-based)",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseStrictPositiveInt(value, 1))
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: "Number of records per page",
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseStrictPositiveInt(value, 10))
  @IsInt()
  @Max(200)
  @Min(1)
  limit: number = 10;
}
