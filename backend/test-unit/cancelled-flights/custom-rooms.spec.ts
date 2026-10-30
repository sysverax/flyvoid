import { describe, expect, it } from "@jest/globals";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";

// The checks are private and only use validateSplit, so call them on the prototype.
const proto = HotelAllocationService.prototype as any;
const self = { validateSplit: proto.validateSplit };
const roomsError = (adults: number, children: number, rooms: Array<[number, number]>) =>
  proto.customRoomsError.call(
    self,
    { adults, children },
    rooms.map(([a, c]) => ({ adults: a, children: c })),
  );
const possible = (adults: number, children: number) =>
  proto.arrangementPossible.call(self, { adults, children });

describe("custom room arrangements", () => {
  it("accepts rooms that place everyone with an adult in every room", () => {
    expect(roomsError(2, 5, [[1, 4], [1, 1]])).toBeNull();
    expect(roomsError(1, 4, [[1, 4]])).toBeNull();
  });

  it.each([
    ["more than 4 children in a room", 1, 5, [[1, 5]], "at most 4 children"],
    ["more than 6 adults in a room", 7, 0, [[7, 0]], "at most 6 adults"],
    ["a room without an adult", 2, 2, [[2, 0], [0, 2]], "at least one adult per room"],
    ["not everyone placed", 2, 1, [[2, 0]], "exactly 2 adult(s) and 1 child(ren)"],
    ["10 rooms", 10, 0, Array(10).fill([1, 0]), "1 to 9 rooms"],
  ] as Array<[string, number, number, Array<[number, number]>, string]>)(
    "rejects %s",
    (_label, adults, children, rooms, message) => {
      expect(roomsError(adults, children, rooms)).toContain(message);
    },
  );

  it.each([
    [1, 4, true],
    [1, 5, false], // one adult, so one room, at most 4 children
    [2, 8, true],
    [2, 9, false],
    [9, 36, true],
    [12, 36, true], // rooms are capped at 9 but adults can share
    [0, 1, false],
  ])("adults=%i children=%i possible=%s", (adults, children, expected) => {
    expect(possible(adults, children)).toBe(expected);
  });
});
