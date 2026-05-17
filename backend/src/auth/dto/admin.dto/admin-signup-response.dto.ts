import { ApiProperty } from "@nestjs/swagger";
import { AdminRole } from "../../../common/constants/user.constants";

export class AdminSignupResponseDto {
  @ApiProperty({
    description: "Admin unique identifier",
    example: 1,
  })
  id!: number;

  @ApiProperty({
    description: "Admin email",
    example: "admin@example.com",
  })
  email!: string;

  @ApiProperty({
    description: "Admin role",
    enum: AdminRole,
    example: AdminRole.SUPER_ADMIN,
  })
  role!: AdminRole;
}
