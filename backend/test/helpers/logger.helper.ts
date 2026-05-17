import {
  logFail,
  logInfo,
  logPass,
  logSuite,
} from "../shared/utils/test-console.util";
import {
  TestCaseFailLog,
  TestCaseMeta,
  TestCasePassLog,
} from "../shared/interfaces/test-case.interface";

export const loggerHelper = {
  suite: (suiteName: string): void => logSuite(suiteName),
  info: (message: string): void => logInfo(message),
  pass: (meta: TestCaseMeta, actualStatus: number, message?: string): void => {
    const payload: TestCasePassLog = {
      ...meta,
      actualStatus,
      message,
    };
    logPass(payload);
  },
  fail: (meta: TestCaseMeta, actualStatus: number, reason: string): void => {
    const payload: TestCaseFailLog = {
      ...meta,
      actualStatus,
      reason,
    };
    logFail(payload);
  },
};
