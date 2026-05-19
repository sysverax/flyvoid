import { INestApplication } from "@nestjs/common";
import { DataSource, EntityTarget, ObjectLiteral } from "typeorm";

const getDataSource = (app: INestApplication): DataSource =>
  app.get(DataSource);

const query = async (
  app: INestApplication,
  sql: string,
  parameters: unknown[] = [],
): Promise<unknown[]> => {
  return await getDataSource(app).query(sql, parameters);
};

const update = async (
  app: INestApplication,
  entity: EntityTarget<ObjectLiteral>,
  criteria: Record<string, unknown>,
  partial: Record<string, unknown>,
): Promise<number> => {
  const result = await getDataSource(app)
    .getRepository(entity)
    .update(criteria, partial);
  return result.affected ?? 0;
};

const remove = async (
  app: INestApplication,
  entity: EntityTarget<ObjectLiteral>,
  criteria: Record<string, unknown>,
): Promise<number> => {
  const result = await getDataSource(app)
    .getRepository(entity)
    .delete(criteria);
  return result.affected ?? 0;
};

export const testDbHelper = {
  getDataSource,
  query,
  update,
  remove,
};
