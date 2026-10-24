import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

/** `shorten=true` returns only the fields a dropdown needs. */
export class ShortenQueryDto {
  @ApiPropertyOptional({
    description:
      "Return only the fields needed for a dropdown (default false: full details)",
    example: true,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean({ message: "shorten must be true or false" })
  shorten?: boolean = false;
}
