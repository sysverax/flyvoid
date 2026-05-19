import { INestApplication } from "@nestjs/common";
import { loggerHelper } from "../../helpers/logger.helper";

let externalModeLogged = false;

export const seedGlobalTestData = async (
  app: INestApplication,
): Promise<void> => {
  void app;

  if (!externalModeLogged) {
    loggerHelper.info("Internal backend mode enabled");
    externalModeLogged = true;
  }
};
