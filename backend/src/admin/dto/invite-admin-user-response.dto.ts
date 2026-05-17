import { ApiProperty } from "@nestjs/swagger";
import { AdminUserResponseDto } from "./admin-user-response.dto";

export class InviteAdminUserResponseDto {
  @ApiProperty({
    description: "Created admin profile",
    type: AdminUserResponseDto,
  })
  admin!: AdminUserResponseDto;

  @ApiProperty({
    description:
      "Temporary password generated for first login. Share securely with the invited admin.",
    example: "Tmp@9aK2mN8pQ",
  })
  temporaryPassword!: string;
}
