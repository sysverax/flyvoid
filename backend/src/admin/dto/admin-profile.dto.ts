import { ApiProperty } from "@nestjs/swagger";
import { AdminRole } from "../../common/constants/user.constants";
import { PlatformAccessControlInputDto } from "./platform-access-control-input.dto";

export class AdminProfileDto {
  @ApiProperty({
    type: Number,
    description: "Admin unique identifier",
    example: 1,
  })
  id!: number;

  @ApiProperty({
    type: String,
    description: "Admin first name",
    example: "John",
  })
  firstName!: string;

  @ApiProperty({
    type: String,
    description: "Admin last name",
    example: "Doe",
  })
  lastName!: string;

  @ApiProperty({
    type: String,
    description: "Admin email",
    example: "admin@example.com",
  })
  email!: string;

  @ApiProperty({
    type: String,
    description: "Admin role",
    enum: AdminRole,
    example: AdminRole.SUPER_ADMIN,
  })
  role!: AdminRole;

  @ApiProperty({
    description: "Platform asset access controls assigned to this admin",
    type: PlatformAccessControlInputDto,
    isArray: true,
  })
  accessControls!: PlatformAccessControlInputDto[];
}
