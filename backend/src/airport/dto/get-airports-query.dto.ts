import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { IsSafeText } from "../../common/validator/injection.validator";

export class GetAirportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter by 2-letter country code",
    example: "AE",
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: "countryCode must be a 2-letter uppercase ISO country code",
  })
  @IsSafeText()
  countryCode?: string;

  @ApiPropertyOptional({
    description: "Filter by airport status (true/false or active/inactive)",
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    if (["true", "1", "active"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "inactive"].includes(normalized)) {
      return false;
    }

    return value;
  })
  @IsBoolean()
  @IsSafeText()
  status?: boolean;

  @ApiPropertyOptional({
    description: "Search by name, IATA code, ICAO code, city, country code",
    example: "dub",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  @IsString()
  @MaxLength(50)
  @IsSafeText()
  search?: string;
}
