import { Transform, Type } from "class-transformer";
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
import { AirlineAccessControlInputDto } from "./airline-access-control-input.dto";

export class UpdateAirlineUserRequestDto {
  @ApiPropertyOptional({
    description: "Airline user first name",
    example: "Aisha",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: "Airline user last name",
    example: "Khan",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: "Airline user job title",
    example: "Operations Executive",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({
    description: "Airline user account status. false means suspended.",
    example: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      "Optional airline access controls replacement list for this airline user",
    type: AirlineAccessControlInputDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AirlineAccessControlInputDto)
  accessControls?: AirlineAccessControlInputDto[];
}
