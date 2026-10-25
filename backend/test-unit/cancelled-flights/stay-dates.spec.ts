import { describe, expect, it } from "@jest/globals";
import { addDays, daysBetween, stayDatesError, todayIn } from "../../src/cancelled-flights/stay-dates";

const limits = {
  today: "2026-10-26",
  airportCode: "DXB",
  maxNights: 7,
  maxCheckInDaysAhead: 30,
};
const stay = (checkInDate: string, checkOutDate: string, cancellationDate = "2026-10-25") => ({
  cancellationDate,
  checkInDate,
  checkOutDate,
});

describe("todayIn", () => {
  // 2026-10-25 22:30 UTC
  const now = new Date("2026-10-25T22:30:00Z");

  it("uses the airport's date, not UTC", () => {
    expect(todayIn("Asia/Dubai", now)).toBe("2026-10-26"); // 02:30 next day
    expect(todayIn("Europe/London", now)).toBe("2026-10-25");
    expect(todayIn("America/New_York", now)).toBe("2026-10-25");
  });

  it("handles half-hour offsets", () => {
    expect(todayIn("Asia/Colombo", now)).toBe("2026-10-26"); // 04:00 next day
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-26", "2026-11-02")).toBe(7);
  });

  it("is not affected by daylight-saving changes", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("stayDatesError", () => {
  it("accepts a valid stay starting today", () => {
    expect(stayDatesError(stay("2026-10-26", "2026-10-27"), limits)).toBeNull();
  });

  it("rejects a check-in before today at the airport", () => {
    expect(stayDatesError(stay("2026-10-25", "2026-10-26"), limits)).toBe(
      "Check-in date must be today or later (today at DXB is 2026-10-26)",
    );
  });

  it("rejects a check-in before the cancellation date", () => {
    expect(
      stayDatesError(stay("2026-10-27", "2026-10-28", "2026-10-28"), limits),
    ).toBe("Check-in date cannot be before the cancellation date (2026-10-28)");
  });

  it("allows a past cancellation date when check-in is today or later", () => {
    expect(
      stayDatesError(stay("2026-10-26", "2026-10-27", "2026-10-24"), limits),
    ).toBeNull();
  });

  it("rejects a check-out on or before check-in", () => {
    const message = "Check-out date must be after the check-in date";
    expect(stayDatesError(stay("2026-10-27", "2026-10-27"), limits)).toBe(message);
    expect(stayDatesError(stay("2026-10-27", "2026-10-26"), limits)).toBe(message);
  });

  it("allows exactly the maximum nights and rejects one more", () => {
    expect(stayDatesError(stay("2026-10-26", "2026-11-02"), limits)).toBeNull();
    expect(stayDatesError(stay("2026-10-26", "2026-11-03"), limits)).toBe(
      "The stay cannot be longer than 7 nights (8 requested)",
    );
  });

  it("allows check-in exactly the maximum days ahead and rejects one more", () => {
    expect(stayDatesError(stay("2026-11-25", "2026-11-26"), limits)).toBeNull();
    expect(stayDatesError(stay("2026-11-26", "2026-11-27"), limits)).toBe(
      "Check-in date cannot be more than 30 days ahead (latest 2026-11-25)",
    );
  });
});
