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
import { AirlineAccessControlInputDto } from "./airline-access-control-input.dto";

export class InviteAirlineUserRequestDto {
  @ApiProperty({
    description: "Airline user first name",
    example: "Aisha",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    description: "Airline user last name",
    example: "Khan",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({
    description: "Airline user email address",
    example: "aisha.khan@skyjet.com",
  })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Airline user job title",
    example: "Operations Executive",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  jobTitle!: string;

  @ApiProperty({
    description: "Airline user account status",
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: "Airline access controls to assign for the invited user",
    type: AirlineAccessControlInputDto,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AirlineAccessControlInputDto)
  accessControls!: AirlineAccessControlInputDto[];
}
