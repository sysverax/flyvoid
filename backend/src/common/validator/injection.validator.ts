import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

const INJECTION_PATTERNS: RegExp[] = [
  /<script\b/i,
  /<\/script>/i,
  /\bon\w+\s*=/i,
  /--/,
  /\/\*/,
  /\*\//,
  /;\s*(drop|select|insert|delete|update|truncate|alter|create|union)\b/i,
  /\b(drop|select|insert|delete|update|truncate|alter|create|union)\b\s+.*\b(from|into|table|set|where)\b/i,
];

function hasInjectionPattern(value: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

export function IsSafeText(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: "isSafeText",
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) {
            return true;
          }

          if (typeof value !== "string") {
            return false;
          }

          if (value.trim().length === 0) {
            return true;
          }

          return !hasInjectionPattern(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} contains potentially unsafe content`;
        },
      },
    });
  };
}
