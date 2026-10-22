import { Transform } from "class-transformer";
import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { TimestampRangeQueryDto } from "../../common/dto/date-range-query.dto";
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

// startDate/endDate filter transaction creation time (a timestamp column):
// ISO 8601 with timezone, start inclusive, end exclusive.
export class GetWalletTransactionsQueryDto extends IntersectionType(
  PaginationQueryDto,
  TimestampRangeQueryDto,
) {
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
}
