import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { createTestApp } from "./setup/test-app";
import { loggerHelper } from "./helpers/logger.helper";
import { requestHelper } from "./helpers/request.helper";
import { responseHelper } from "./helpers/response.helper";
import { TestCaseMeta } from "./shared/interfaces/test-case.interface";

describe("Application E2E Smoke", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Application E2E Smoke");
  });

  afterAll(async () => {
    await app.close();
  });

  it("TC_APP_HEALTH_001 - should return health check successfully", async () => {
    const meta: TestCaseMeta = {
      id: "TC_APP_HEALTH_001",
      description: "Health endpoint success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.get(app, "/api/v1/health");
      actualStatus = response.status;
      const body = responseHelper.expectSuccess(response, 200);

      expect(body.data).toBeDefined();
      loggerHelper.pass(meta, actualStatus, body.message);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });
});
