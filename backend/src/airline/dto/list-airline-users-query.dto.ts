import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListAirlineUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Search by first name, last name, or email",
    example: "John",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
