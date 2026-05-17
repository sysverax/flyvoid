import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AdminRole } from "../../common/constants/user.constants";
import { Type } from "class-transformer";
import { PlatformAccessControlInputDto } from "./platform-access-control-input.dto";

export class UpdateAdminUserRequestDto {
  @ApiPropertyOptional({
    description: "Admin first name",
    example: "Jane",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: "Admin last name",
    example: "Walker",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: "Admin email address",
    example: "jane.walker@flyvoid.com",
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "Admin role",
    enum: AdminRole,
    example: AdminRole.STAFF,
  })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional({
    description: "Admin account status. false means suspended.",
    example: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      "Optional platform access controls replacement list for this admin user",
    type: PlatformAccessControlInputDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PlatformAccessControlInputDto)
  accessControls?: PlatformAccessControlInputDto[];
}
