import { Transform, Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AdminRole } from "../../common/constants/user.constants";
import { PlatformAccessControlInputDto } from "./platform-access-control-input.dto";

export class InviteAdminUserRequestDto {
  @ApiProperty({
    description: "Admin first name",
    example: "Jane",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    description: "Admin last name",
    example: "Walker",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description: "Admin email address",
    example: "jane.walker@flyvoid.com",
  })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Admin role to assign",
    enum: AdminRole,
    example: AdminRole.STAFF,
  })
  @IsEnum(AdminRole)
  role!: AdminRole;

  @ApiProperty({
    description: "Admin account status",
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Platform access controls to assign for the invited admin",
    type: PlatformAccessControlInputDto,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PlatformAccessControlInputDto)
  accessControls!: PlatformAccessControlInputDto[];
}
