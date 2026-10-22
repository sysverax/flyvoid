import { ArgumentsHost, Catch } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { QueryFailedError } from "typeorm";
import { toUnsupportedTimeZoneException } from "../utils/time-zone-error.util";

/**
 * Global filter for database query errors only. A timezone Postgres doesn't
 * recognise (time-frame APIs) becomes 400 "Unsupported timezone"; every
 * other query error goes to Nest's default handler unchanged (500).
 */
@Catch(QueryFailedError)
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    super.catch(toUnsupportedTimeZoneException(exception) ?? exception, host);
  }
}
