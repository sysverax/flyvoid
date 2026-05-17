import { Module } from "@nestjs/common";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "../config/config";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (): TypeOrmModuleOptions => {
        if (config.db.simulate) {
          return {
            type: "sqljs",
            autoSave: false,
            location: "database",
            synchronize: true,
            logging: config.db.logging,
            autoLoadEntities: true,
          };
        }

        return {
          type: "postgres",
          host: config.db.host,
          port: config.db.port,
          username: config.db.username,
          password: config.db.password,
          database: config.db.name,
          synchronize: config.db.synchronize,
          logging: config.db.logging,
          autoLoadEntities: true,
        };
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error("TypeORM options are not defined.");
        }

        try {
          const dataSource = new DataSource(options);
          return await dataSource.initialize();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown database error";
          throw new Error(`Database connection failed: ${message}`);
        }
      },
    }),
  ],
})
export class DatabaseModule {}
