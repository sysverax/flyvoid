import { TEST_STATUS } from "../constants/test-status.constants";
import {
  TestCaseFailLog,
  TestCasePassLog,
} from "../interfaces/test-case.interface";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
};

const colorize = (color: keyof typeof colors, text: string): string =>
  `${colors[color]}${text}${colors.reset}`;

const writeLine = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const infoLogsEnabled = process.env.E2E_VERBOSE_LOGS === "true";

export const logSuite = (suiteName: string): void => {
  const line = "=".repeat(90);
  writeLine(colorize("cyan", `\n${line}`));
  writeLine(colorize("cyan", `[${TEST_STATUS.SUITE}] ${suiteName}`));
  writeLine(colorize("cyan", line));
};

export const logPass = (entry: TestCasePassLog): void => {
  writeLine(
    colorize(
      "green",
      `[${TEST_STATUS.PASS}] ${entry.id} | ${entry.description} | Status: ${entry.actualStatus} | Expected: ${entry.expectedStatus} | Message: ${entry.message ?? "N/A"}`,
    ),
  );
};

export const logFail = (entry: TestCaseFailLog): void => {
  writeLine(
    colorize(
      "red",
      `[${TEST_STATUS.FAILED}] ${entry.id} | ${entry.description} | Expected: ${entry.expectedStatus} | Actual: ${entry.actualStatus} | Reason: ${entry.reason}`,
    ),
  );
};

export const logInfo = (message: string): void => {
  if (!infoLogsEnabled) {
    return;
  }

  writeLine(colorize("yellow", `[INFO] ${message}`));
};
