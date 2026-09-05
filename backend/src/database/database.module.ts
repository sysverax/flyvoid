// import { Module, OnModuleDestroy, Logger } from "@nestjs/common";
// import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
// import { DataSource, DataSourceOptions } from "typeorm";
// import { config } from "../config/config";

// @Module({
//   imports: [
//     TypeOrmModule.forRootAsync({
//       useFactory: (): TypeOrmModuleOptions => {
//         return {
//           type: "postgres",
//           host: config.db.host,
//           port: config.db.port,
//           username: config.db.username,
//           password: config.db.password,
//           database: config.db.name,
//           synchronize:
//             config.db.mode === "automation_test" ? true : config.db.synchronize,
//           logging: config.db.logging,
//           autoLoadEntities: true,
//           extra: {
//             ssl: {
//               rejectUnauthorized: config.db.ssl,
//             },
//           },
//         };
//       },

//       dataSourceFactory: async (options) => {
//         if (!options) {
//           throw new Error("TypeORM options are not defined.");
//         }

//         try {
//           const dataSource = new DataSource(options as DataSourceOptions);
//           return await dataSource.initialize();
//         } catch (error) {
//           const message =
//             error instanceof Error ? error.message : "Unknown database error";
//           throw new Error(`Database connection failed: ${message}`);
//         }
//       },
//     }),
//   ],
// })
// export class DatabaseModule implements OnModuleDestroy {
//   private readonly logger = new Logger(DatabaseModule.name);

//   constructor(private readonly dataSource: DataSource) {}

//   async onModuleDestroy(): Promise<void> {
//     if (config.db.mode === "automation_test") {
//       try {
//         // Wipe all data at the end of each test run
//         await this.dataSource.dropDatabase();
//         this.logger.log("Test database dropped successfully.");
//       } catch (error) {
//         this.logger.error("Failed to drop test database.", error);
//       }
//     }

//     if (this.dataSource.isInitialized) {
//       await this.dataSource.destroy();
//       this.logger.log("Database connection closed.");
//     }
//   }
// }

import { Module, OnModuleDestroy, Logger } from "@nestjs/common";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "../config/config";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (): TypeOrmModuleOptions => {
        const isAutomationTest = config.db.mode === "automation_test";

        return {
          type: "postgres",

          host: config.db.host,
          port: config.db.port,
          username: config.db.username,
          password: config.db.password,
          database: config.db.name,

          synchronize: isAutomationTest ? true : config.db.synchronize,

          logging: config.db.logging,

          autoLoadEntities: true,

          // Neon PostgreSQL connection
          ssl: {
            rejectUnauthorized: false,
          },

          // PostgreSQL connection pool settings
          extra: {
            max: 5,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
          },
        };
      },

      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error("TypeORM options are not defined.");
        }

        try {
          const dataSource = new DataSource(options as DataSourceOptions);

          await dataSource.initialize();

          return dataSource;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown database error";

          console.error("========================================");
          console.error("DATABASE CONNECTION ERROR");
          console.error("========================================");
          console.error(error);

          throw new Error(`Database connection failed: ${message}`);
        }
      },
    }),
  ],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleDestroy(): Promise<void> {
    if (config.db.mode === "automation_test") {
      try {
        // Wipe all data at the end of each test run
        await this.dataSource.dropDatabase();

        this.logger.log("Test database dropped successfully.");
      } catch (error) {
        this.logger.error(
          "Failed to drop test database.",
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();

      this.logger.log("Database connection closed.");
    }
  }
}
