import { describe, expect, it, jest } from "@jest/globals";
import { QueryFailedError } from "typeorm";
import { isLockConflictError, retryOnLockConflict } from "./lock-retry.util";

function queryFailed(code: string): QueryFailedError {
  const driverError = Object.assign(new Error(`pg error ${code}`), { code });
  return new QueryFailedError("SELECT 1", [], driverError);
}

describe("isLockConflictError", () => {
  it("matches deadlocks and lock timeouts", () => {
    expect(isLockConflictError(queryFailed("40P01"))).toBe(true);
    expect(isLockConflictError(queryFailed("55P03"))).toBe(true);
  });

  it("does not match other database errors", () => {
    expect(isLockConflictError(queryFailed("23505"))).toBe(false);
    expect(isLockConflictError(new Error("boom"))).toBe(false);
    expect(isLockConflictError(undefined)).toBe(false);
  });
});

describe("retryOnLockConflict", () => {
  it("returns the result without retrying when the work succeeds", async () => {
    const work = jest.fn(async () => "done");
    await expect(retryOnLockConflict(work)).resolves.toBe("done");
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("retries a deadlocked transaction and returns its result", async () => {
    const work = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(queryFailed("40P01"))
      .mockResolvedValueOnce("done");
    await expect(retryOnLockConflict(work)).resolves.toBe("done");
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt", async () => {
    const deadlock = queryFailed("40P01");
    const work = jest.fn(async () => {
      throw deadlock;
    });
    await expect(retryOnLockConflict(work, 3)).rejects.toBe(deadlock);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const duplicate = queryFailed("23505");
    const work = jest.fn(async () => {
      throw duplicate;
    });
    await expect(retryOnLockConflict(work)).rejects.toBe(duplicate);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
