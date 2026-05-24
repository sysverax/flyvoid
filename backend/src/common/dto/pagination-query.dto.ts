import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

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
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? 1 : Number(value),
  )
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: "Number of records per page",
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? 10 : Number(value),
  )
  @IsInt()
  @Min(1)
  limit: number = 10;
}
