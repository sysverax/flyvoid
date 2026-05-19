import { INestApplication } from "@nestjs/common";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import request from "supertest";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminFactory } from "../../factories/admin.factory";
import { adminAuthSeeder } from "../../seeders/admin/admin.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";

const SIGNIN_ENDPOINT = "/api/v1/auth/admin/signin";



