import { ApiProperty } from "@nestjs/swagger";

export class AirlineTwoFactorEnableResponseDto {
  @ApiProperty({
    type: [String],
    example: ["ABCD2EFGH3", "JKL45MNOP6", "QRST7UVWX8"],
  })
  recoveryCodes!: string[];
}
