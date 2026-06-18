import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEnum } from "class-validator";
import {
  AccessAction,
  AirlineAsset,
} from "../../common/constants/access-control.constants";

export class AirlineAccessControlInputDto {
  @ApiProperty({
    description: "Airline asset/module key",
    enum: AirlineAsset,
    example: AirlineAsset.AIRLINE_USERS,
  })
  @IsEnum(AirlineAsset)
  asset!: AirlineAsset;

  @ApiProperty({
    description: "Allowed actions for the selected asset",
    enum: AccessAction,
    isArray: true,
    example: [AccessAction.VIEW, AccessAction.EDIT],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(AccessAction, { each: true })
  access!: AccessAction[];
}
