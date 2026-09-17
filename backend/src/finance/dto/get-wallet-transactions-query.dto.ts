import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { PAYMENT_STATUSES } from "../constants";
import { TRANSACTION_REFERENCE_TYPES } from "../constants";

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const num = Number(value);
  return Number.isInteger(num) ? num : value;
};

export class GetWalletTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter by airline id (platform users only)",
    example: 12,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "airlineId must be an integer" })
  @Min(1, { message: "airlineId must be greater than or equal to 1" })
  @IsOptional()
  airlineId?: number;

  @ApiPropertyOptional({
    description:
      "Filter by transaction type: adjustment or cancelled flight cost",
    enum: TRANSACTION_REFERENCE_TYPES,
    example: TRANSACTION_REFERENCE_TYPES.ADJUSTMENT,
  })
  @IsEnum(TRANSACTION_REFERENCE_TYPES, {
    message: "type must be a valid transaction reference type",
  })
  @IsOptional()
  type?: TRANSACTION_REFERENCE_TYPES;

  @ApiPropertyOptional({
    description:
      "Filter by transaction status. All transactions are currently SUCCESS (manual transfers only) until payment gateway integration is added.",
    enum: PAYMENT_STATUSES,
    example: PAYMENT_STATUSES.SUCCESS,
  })
  @IsEnum(PAYMENT_STATUSES, {
    message: "status must be a valid payment status",
  })
  @IsOptional()
  status?: PAYMENT_STATUSES;

  @ApiPropertyOptional({
    description: "Filter transactions created on or after this date",
    example: "2026-09-01",
  })
  @IsDateString(
    {},
    { message: "startDate must be a valid ISO 8601 date string" },
  )
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter transactions created on or before this date",
    example: "2026-09-30",
  })
  @IsDateString({}, { message: "endDate must be a valid ISO 8601 date string" })
  @IsOptional()
  endDate?: string;
}
