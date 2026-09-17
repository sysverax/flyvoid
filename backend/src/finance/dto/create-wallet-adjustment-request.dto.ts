import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
import { TRANSACTION_TYPES } from "../constants";

export class CreateWalletAdjustmentRequestDto {
  @ApiProperty({
    description: "Airline id whose wallet is being adjusted",
    example: 12,
  })
  @IsInt({ message: "airlineId must be an integer" })
  @Min(1, { message: "airlineId must be greater than or equal to 1" })
  @IsNotEmpty({
    message: "airlineId is required",
  })
  airlineId!: number;

  @ApiProperty({
    description: "CREDIT increases the wallet balance, DEBIT decreases it",
    enum: TRANSACTION_TYPES,
    example: TRANSACTION_TYPES.CREDIT,
  })
  @IsEnum(TRANSACTION_TYPES, { message: "type must be either CREDIT or DEBIT" })
  @IsNotEmpty({ message: "type is required" })
  type!: TRANSACTION_TYPES;

  @ApiProperty({
    description:
      "Adjustment amount (up to 2 decimal places, must be greater than 0)",
    example: 500,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "amount must be a number with up to 2 decimal places" },
  )
  @IsPositive({ message: "amount must be greater than 0" })
  amount!: number;

  @ApiPropertyOptional({
    description:
      "Reason for the adjustment. Optional for CREDIT, mandatory for DEBIT.",
    example: "Manual bank transfer top-up",
  })
  @ValidateIf(
    (dto: CreateWalletAdjustmentRequestDto) =>
      dto.type === TRANSACTION_TYPES.DEBIT,
  )
  @IsNotEmpty({ message: "reason is required when type is DEBIT" })
  @IsString()
  reason?: string;
}
