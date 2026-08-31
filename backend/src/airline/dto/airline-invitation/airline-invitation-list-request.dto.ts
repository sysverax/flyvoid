import { Transform } from "class-transformer";
import { BadRequestException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { AIRLINE_INVITATION_STATUSES } from "../../constants";

export class AirlineInvitationListRequestDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter invitations by country code (ISO alpha-2)",
    example: "AE",
  })
  @Matches(/^[A-Z]{2}$/, {
    message: "countryCode must be a 2-letter uppercase ISO country code",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsOptional()
  countryCode?: string;

  //  multiple status with comma separated values and each status should be one of the values in AIRLINE_INVITATION_STATUSES
  @ApiPropertyOptional({
    description: "Filter invitations by status (comma-separated values)",
    example: "pending,accepted",
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: "Search invitations by email or name",
    example: "john.doe@example.com",
  })
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsOptional()
  search?: string;

  validStatuses?: AIRLINE_INVITATION_STATUSES[];

  validate() {
    if (this.status) {
      const statuses = this.status
        .split(",")
        .map((s) => s.trim().split(",")[0].toUpperCase());
      const validStatuses = Object.values(
        AIRLINE_INVITATION_STATUSES,
      ) as string[];
      const invalidStatuses = statuses.filter(
        (s) => !validStatuses.includes(s),
      );
      if (invalidStatuses.length > 0) {
        throw new BadRequestException(
          `Invalid statuses: ${invalidStatuses.join(", ")}`,
        );
      }
      this.validStatuses = statuses as AIRLINE_INVITATION_STATUSES[];
    }
  }
}
