import { INestApplication } from "@nestjs/common";
import { loggerHelper } from "../../helpers/logger.helper";
import { isExternalMode } from "../../setup/test-app";

let externalModeLogged = false;

export const seedGlobalTestData = async (
  app: INestApplication,
): Promise<void> => {
  void app;

  if (!externalModeLogged) {
    const modeMessage = isExternalMode()
      ? "External backend mode enabled"
      : "External backend mode flag disabled";
    loggerHelper.info(modeMessage);
    externalModeLogged = true;
  }
};
