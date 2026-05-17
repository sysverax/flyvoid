import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./controllers/admin.controller";
import { AdminEntity } from "./entities/admin.entity";
import { PlatformAccessControlEntity } from "./entities/platform-access-control.entity";
import { AdminRepository } from "./repositories/admin.repository";
import { AdminService } from "./services/admin.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminEntity, PlatformAccessControlEntity]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
