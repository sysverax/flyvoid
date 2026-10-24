import { PickType } from "@nestjs/swagger";
import { AdminAirlineQueryDto } from "../../airline/dto/admin-airline-query.dto";

/** The admin airline list filters (same names and validation as GET /airline). */
export class GetWalletsSummaryQueryDto extends PickType(AdminAirlineQueryDto, [
  "search",
  "countryCode",
  "isActive",
  "isSuspended",
] as const) {}
