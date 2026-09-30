import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AirlineTwoFactorRecoverRequestDto {
  @ApiProperty({ description: "2FA challenge token from signin response" })
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @ApiProperty({ example: "ABCD2EFGH3" })
  @Transform(({ value }: { value: string }) => value.trim().toUpperCase())
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}
