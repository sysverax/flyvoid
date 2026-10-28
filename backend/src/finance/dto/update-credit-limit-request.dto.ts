import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** wallets.credit_limit is numeric(12,2). */
export const MAX_CREDIT_LIMIT = 9_999_999_999.99;

// class-validator runs a property's decorators bottom-up: type checks sit
// closest to the property so they report first (stopAtFirstError).
export class UpdateCreditLimitRequestDto {
  @ApiProperty({
    description:
      "New credit limit (0 or more, up to 2 decimal places). May be below what the airline already uses: available balance then goes negative and new hotel allocations are blocked until the wallet is topped up.",
    example: 5000,
  })
  @Max(MAX_CREDIT_LIMIT, {
    message: `creditLimit must be at most ${MAX_CREDIT_LIMIT}`,
  })
  @Min(0, { message: "creditLimit must be 0 or more" })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: "creditLimit must be a number with up to 2 decimal places" },
  )
  creditLimit!: number;

  @ApiProperty({
    description: "Why the credit limit is changing (stored in the credit limit history)",
    example: "Reduced after overdue invoices",
    minLength: 3,
    maxLength: 255,
  })
  @MaxLength(255, { message: "reason must be at most 255 characters" })
  @MinLength(3, { message: "reason must be at least 3 characters" })
  @IsNotEmpty({ message: "reason is required" })
  @IsString({ message: "reason must be a string" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reason!: string;
}
