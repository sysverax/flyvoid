export const TEST_STATUS = {
  PASS: "PASS",
  FAILED: "FAILED",
  SUITE: "SUITE",
} as const;

export type TestStatus = (typeof TEST_STATUS)[keyof typeof TEST_STATUS];
