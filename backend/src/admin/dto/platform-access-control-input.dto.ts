import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEnum } from "class-validator";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";

export class PlatformAccessControlInputDto {
  @ApiProperty({
    description: "Platform asset/module key",
    enum: PlatformAsset,
    example: PlatformAsset.AIRLINES,
  })
  @IsEnum(PlatformAsset)
  asset!: PlatformAsset;

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
