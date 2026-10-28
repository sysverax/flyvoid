import { describe, expect, it } from "@jest/globals";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateCreditLimitRequestDto } from "../../../src/finance/dto/update-credit-limit-request.dto";
import { UpdateAirlineRequestDto } from "../../../src/airline/dto/update-airline-request.dto";

// Mirrors the global ValidationPipe options in main.ts.
async function messages<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe("UpdateCreditLimitRequestDto", () => {
  it.each([0, 5000, 2500.5])("accepts %p", async (creditLimit) => {
    expect(await messages(UpdateCreditLimitRequestDto, { creditLimit, reason: "Overdue invoices" })).toEqual([]);
  });

  it("trims the reason", async () => {
    const dto = plainToInstance(UpdateCreditLimitRequestDto, { creditLimit: 1, reason: "  Top-up agreed  " });
    expect(dto.reason).toBe("Top-up agreed");
  });

  it.each([
    ["negative", { creditLimit: -1, reason: "abc" }, "creditLimit must be 0 or more"],
    ["3 decimals", { creditLimit: 1.234, reason: "abc" }, "creditLimit must be a number with up to 2 decimal places"],
    ["not a number", { creditLimit: "100", reason: "abc" }, "creditLimit must be a number with up to 2 decimal places"],
    ["too large", { creditLimit: 10_000_000_000, reason: "abc" }, "creditLimit must be at most 9999999999.99"],
    ["missing reason", { creditLimit: 1 }, "reason must be a string"],
    ["blank reason", { creditLimit: 1, reason: "   " }, "reason is required"],
    ["short reason", { creditLimit: 1, reason: "ab" }, "reason must be at least 3 characters"],
    ["long reason", { creditLimit: 1, reason: "x".repeat(256) }, "reason must be at most 255 characters"],
  ])("rejects %s", async (_label, body, message) => {
    expect(await messages(UpdateCreditLimitRequestDto, body)).toContain(message);
  });
});

describe("UpdateAirlineRequestDto.platformFeePercentage", () => {
  it.each([0, 12.5, 99.99])("accepts %p", async (platformFeePercentage) => {
    expect(await messages(UpdateAirlineRequestDto, { platformFeePercentage })).toEqual([]);
  });

  it.each([
    [-0.01, "platformFeePercentage must be 0 or more"],
    [100, "platformFeePercentage must be less than 100"],
  ])("rejects %p", async (platformFeePercentage, message) => {
    expect(await messages(UpdateAirlineRequestDto, { platformFeePercentage })).toContain(message);
  });
});
