import { ApiProperty } from "@nestjs/swagger";
import { AdminRole } from "../../common/constants/user.constants";

export class AdminUserResponseDto {
  @ApiProperty({ description: "Admin unique identifier", example: 3 })
  id!: number;

  @ApiProperty({ description: "Admin first name", example: "Jane" })
  firstName!: string;

  @ApiProperty({ description: "Admin last name", example: "Walker" })
  lastName!: string;

  @ApiProperty({
    description: "Admin email",
    example: "jane.walker@flyvoid.com",
  })
  email!: string;

  @ApiProperty({
    description: "Admin role",
    enum: AdminRole,
    example: AdminRole.STAFF,
  })
  role!: AdminRole;

  @ApiProperty({ description: "Account active status", example: true })
  isActive!: boolean;

  @ApiProperty({
    description: "Last login timestamp",
    example: "2026-05-16T09:10:11.000Z",
    nullable: true,
  })
  lastLoginAt!: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2026-05-16T08:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2026-05-16T08:30:00.000Z",
  })
  updatedAt!: string;
}
