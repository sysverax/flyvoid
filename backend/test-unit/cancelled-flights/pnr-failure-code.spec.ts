import { describe, expect, it } from "@jest/globals";
import { pnrFailureCode } from "../../src/cancelled-flights/hotel-allocation.service";

describe("pnrFailureCode", () => {
  it.each([
    ["Invalid passenger data: No room split rule configured for adults=1, children=5", "NO_ROOM_SPLIT"],
    ["Invalid passenger data: Adults must be at least 1", "INVALID_PASSENGERS"],
    ["No hotel near the airport has rooms left for this booking's room split", "NO_AVAILABILITY"],
    ["No remaining hotel candidates could be booked; last failure: Grand: soldout", "BOOKING_REJECTED"],
    ["Gave up after 3 failed booking attempt(s); last failure: Grand: soldout", "BOOKING_REJECTED"],
    ["Something unexpected", "OTHER"],
    [null, "OTHER"],
  ])("%s -> %s", (reason, code) => {
    expect(pnrFailureCode(reason)).toBe(code);
  });
});
