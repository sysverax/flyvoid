import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import { isIanaTimeZone } from "../utils/time-frame.util";

/**
 * Accepts only named IANA timezones such as "Asia/Dubai" or "UTC". Stricter
 * than class-validator's @IsTimeZone(), which on newer Node versions also
 * accepts raw offsets like "+05:30" that Postgres interprets with the
 * opposite sign.
 */
export function IsIanaTimeZone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: "isIanaTimeZone",
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) {
            return true;
          }

          return typeof value === "string" && isIanaTimeZone(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid IANA timezone, e.g. "Asia/Dubai" or "UTC"`;
        },
      },
    });
  };
}
