import { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { AdminAirlineQueryDto } from "../dto/admin-airline-query.dto";

export type AirlineListFilters = Pick<
  AdminAirlineQueryDto,
  "search" | "countryCode" | "isActive" | "isSuspended"
>;

/**
 * The admin airline list filters. Shared by the list (GET /airline) and the
 * wallets summary (GET /wallets/summary) so both count the same airlines.
 * `alias` is the airlines table alias in the query.
 */
export function applyAirlineListFilters<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  filters: AirlineListFilters,
): SelectQueryBuilder<T> {
  if (filters.search) {
    qb.andWhere(
      `(${alias}.name ILIKE :search OR ${alias}.code ILIKE :search)`,
      { search: `%${filters.search}%` },
    );
  }

  if (filters.isActive !== undefined) {
    qb.andWhere(`${alias}.isActive = :isActive`, {
      isActive: filters.isActive,
    });
  }

  if (filters.isSuspended !== undefined) {
    qb.andWhere(`${alias}.isSuspended = :isSuspended`, {
      isSuspended: filters.isSuspended,
    });
  }

  if (filters.countryCode) {
    qb.andWhere(`${alias}.countryCode = :countryCode`, {
      countryCode: filters.countryCode,
    });
  }

  return qb;
}
