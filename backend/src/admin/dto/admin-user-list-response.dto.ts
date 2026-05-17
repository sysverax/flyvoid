import { ApiProperty } from "@nestjs/swagger";
import { AdminUserResponseDto } from "./admin-user-response.dto";

export class AdminUserListResponseDto {
  @ApiProperty({ description: "Total number of admin users", example: 5 })
  total!: number;

  @ApiProperty({ description: "Current page number", example: 1 })
  currentPage!: number;

  @ApiProperty({ description: "Maximum records returned per page", example: 10 })
  limit!: number;

  @ApiProperty({
    description: "Paginated admin users",
    type: AdminUserResponseDto,
    isArray: true,
  })
  users!: AdminUserResponseDto[];
}
