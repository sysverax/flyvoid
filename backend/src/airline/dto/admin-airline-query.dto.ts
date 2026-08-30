import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class AdminAirlineQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter by active status",
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Filter by suspended status",
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  isSuspended?: boolean;

  @ApiPropertyOptional({
    description: "Filter by country code (ISO 3166-1 alpha-2)",
    example: "AE",
  })
  @Matches(/^[A-Z]{2}$/, {
    message: "countryCode must be a 2-letter uppercase ISO country code",
  })
  @MaxLength(2)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiPropertyOptional({
    description: "Search by airline name or code",
    example: "SkyJet",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
