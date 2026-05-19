import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";

type SqlParams = unknown[];
type Row = Record<string, unknown>;

const getDataSource = (app: INestApplication): DataSource => app.get(DataSource);

const logSql = (operation: "query" | "execute", sql: string, parameters: SqlParams): void => {
  console.log(`[direct-sql:${operation}]`, sql, parameters);
};

const query = async <T extends Row = Row>(
  app: INestApplication,
  sql: string,
  parameters: SqlParams = [],
): Promise<T[]> => {
  logSql("query", sql, parameters);
  return (await getDataSource(app).query(sql, parameters)) as T[];
};

const select = async <T extends Row = Row>(
  app: INestApplication,
  sql: string,
  parameters: SqlParams = [],
): Promise<T[]> => {
  return await query<T>(app, sql, parameters);
};

const first = async <T extends Row = Row>(
  app: INestApplication,
  sql: string,
  parameters: SqlParams = [],
): Promise<T | null> => {
  const rows = await query<T>(app, sql, parameters);
  return rows[0] ?? null;
};

const execute = async (
  app: INestApplication,
  sql: string,
  parameters: SqlParams = [],
): Promise<unknown> => {
  logSql("execute", sql, parameters);
  return await getDataSource(app).query(sql, parameters);
};

export const directSqlHelper = {
  getDataSource,
  query,
  select,
  first,
  execute,
};
