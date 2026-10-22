import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AirlineTwoFactorRecoverRequestDto {
  @ApiProperty({ description: "2FA challenge token from signin response" })
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @ApiProperty({ example: "ABCD2EFGH3" })
  // Leave non-strings as is so @IsString reports a 400 instead of throwing.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}
