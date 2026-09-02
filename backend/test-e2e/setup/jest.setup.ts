/**
 * Jest global setup file.
 * Loaded via `setupFiles` before each test module is executed.
 * Responsibility: load the automation test env file so that
 * BASE_URL and DATABASE_URL are available to every spec file.
 *
 * Does NOT import anything from src/.
 */
import * as dotenv from "dotenv";
import * as path from "path";

// Load automation_test.env from the backend root.
dotenv.config({ path: path.resolve(__dirname, "../../automation_test.env") });

// Derive BASE_URL if not explicitly provided.
if (!process.env.BASE_URL) {
  const port = process.env.APP_PORT ?? "8080";
  process.env.BASE_URL = `http://localhost:${port}`;
}

// Derive DATABASE_URL if not explicitly provided.
if (!process.env.DATABASE_URL) {
  const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } = process.env;
  process.env.DATABASE_URL = `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}
