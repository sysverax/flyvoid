export interface TestCaseMeta {
  id: string;
  description: string;
  expectedStatus: number;
}

export interface TestCasePassLog extends TestCaseMeta {
  actualStatus: number;
  message?: string;
}

export interface TestCaseFailLog extends TestCaseMeta {
  actualStatus: number;
  reason: string;
}
