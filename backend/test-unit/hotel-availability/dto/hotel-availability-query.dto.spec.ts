import { describe, expect, it } from "@jest/globals";
import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { HotelAvailabilityQueryDto } from "../../../src/hotel-availability/dto/hotel-availability-query.dto";

// Mirrors the global ValidationPipe options in main.ts.
async function check(query: Record<string, unknown>) {
  const instance = plainToInstance(HotelAvailabilityQueryDto, query);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
  const messages = (list: ValidationError[]): string[] =>
    list.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...messages(error.children ?? []),
    ]);
  return { instance, messages: messages(errors) };
}

const valid = {
  providerId: "1",
  airportId: "4",
  checkInDate: "2026-11-10",
  checkOutDate: "2026-11-11",
  rooms: '[{"adults":2,"childrenAges":[]}]',
};

describe("HotelAvailabilityQueryDto", () => {
  it("accepts a typical search and parses ids and rooms", async () => {
    const { instance, messages } = await check(valid);
    expect(messages).toEqual([]);
    expect(instance.providerId).toBe(1);
    expect(instance.airportId).toBe(4);
    expect(instance.rooms).toEqual([{ adults: 2, childrenAges: [] }]);
    expect(instance.radius).toBeUndefined();
  });

  it("accepts several rooms with children, a radius and a residency", async () => {
    const { instance, messages } = await check({
      ...valid,
      rooms: '[{"adults":2,"childrenAges":[7,12]},{"adults":1,"childrenAges":[]}]',
      radius: "20",
      residency: "ae",
    });
    expect(messages).toEqual([]);
    expect(instance.rooms).toHaveLength(2);
    expect(instance.radius).toBe(20);
    expect(instance.residency).toBe("AE");
  });

  it.each([
    ["missing rooms", { rooms: undefined }, "rooms must be a JSON array of rooms"],
    ["rooms not JSON", { rooms: "two adults" }, "rooms must be a JSON array of rooms"],
    ["no rooms", { rooms: "[]" }, "rooms must have at least 1 room"],
    [
      "too many rooms",
      { rooms: JSON.stringify(Array(10).fill({ adults: 1, childrenAges: [] })) },
      "rooms can have at most 9 rooms",
    ],
    ["room without adults", { rooms: '[{"adults":0,"childrenAges":[]}]' }, "Each room needs at least 1 adult"],
    ["7 adults", { rooms: '[{"adults":7,"childrenAges":[]}]' }, "A room can have at most 6 adults"],
    ["child age 18", { rooms: '[{"adults":2,"childrenAges":[18]}]' }, "Child ages must be between 0 and 17"],
    ["unknown room field", { rooms: '[{"adults":2,"childrenAges":[],"children":1}]' }, "property children should not exist"],
    ["radius over 70", { radius: "71" }, "radius can be at most 70 km"],
    ["radius 0", { radius: "0" }, "radius must be at least 1 km"],
    ["bad residency", { residency: "UAE" }, "residency must be an ISO 3166-1 alpha-2 country code, e.g. AE"],
    ["date with time", { checkInDate: "2026-11-10T00:00:00Z" }, /^checkInDate must be a calendar date in YYYY-MM-DD format/],
    ["radius not a number", { radius: "ten" }, "radius must be a whole number of km"],
    ["adults not a number", { rooms: '[{"adults":"two","childrenAges":[]}]' }, "rooms[].adults must be an integer"],
  ] as Array<[string, Record<string, unknown>, string | RegExp]>)("rejects %s", async (_label, change, message) => {
    const { messages } = await check({ ...valid, ...change });
    if (message instanceof RegExp) {
      expect(messages.some((text) => message.test(text))).toBe(true);
    } else {
      expect(messages).toContain(message);
    }
  });
});
