import { ApiProperty } from "@nestjs/swagger";

export class AdminTwoFactorEnableResponseDto {
  @ApiProperty({
    description: "One-time recovery codes. Store them securely.",
    type: [String],
    example: ["A7K9L2Q4R8", "M3N6P1T5W9", "X4Y7Z2B8C1"],
  })
  recoveryCodes!: string[];
}
