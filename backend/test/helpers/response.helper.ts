import { Response } from "supertest";
import { expect } from "@jest/globals";

export interface BaseApiResponse<T> {
  success: boolean;
  requestId: string;
  timestamp: string;
  message: string;
  data: T;
}

export const responseHelper = {
  expectSuccess<T>(response: Response, status: number): BaseApiResponse<T> {
    expect(response.status).toBe(status);
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
    expect(typeof response.body.requestId).toBe("string");
    expect(typeof response.body.timestamp).toBe("string");
    expect(typeof response.body.message).toBe("string");
    return response.body as BaseApiResponse<T>;
  },

  expectError(response: Response, status: number, message?: string): void {
    expect(response.status).toBe(status);
    expect(response.body).toBeDefined();
    if (response.body.success !== undefined) {
      expect(response.body.success).toBe(false);
    }
    if (message) {
      expect(response.body.message).toBe(message);
    }
  },
};
