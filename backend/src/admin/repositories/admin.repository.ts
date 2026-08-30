import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AdminUserQueryDto } from "../dto/admin-user-query.dto";
import { LoggerService } from "../../common/logger/logger.service";
import { AdminEntity } from "../entities/admin.entity";
import { PlatformAccessControlEntity } from "../entities/platform-access-control.entity";

@Injectable()
export class AdminRepository {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    @InjectRepository(PlatformAccessControlEntity)
    private readonly platformAccessControlRepository: Repository<PlatformAccessControlEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findById(id: number, requestId: string): Promise<AdminEntity | null> {
    this.logger.debug("Finding admin by id", "AdminRepository", requestId, {
      adminId: id,
    });

    return this.adminRepository.findOne({ where: { id } });
  }

  async findByEmail(
    email: string,
    requestId: string,
  ): Promise<AdminEntity | null> {
    this.logger.debug("Finding admin by email", "AdminRepository", requestId, {
      email,
    });

    return this.adminRepository.findOne({ where: { email } });
  }

  async createAdmin(
    payload: Pick<
      AdminEntity,
      | "firstName"
      | "lastName"
      | "email"
      | "passwordHash"
      | "role"
      | "isActive"
      | "requirePasswordReset"
    >,
    requestId: string,
  ): Promise<AdminEntity> {
    this.logger.debug("Creating admin", "AdminRepository", requestId, {
      email: payload.email,
      role: payload.role,
    });

    const admin = this.adminRepository.create(payload);
    return this.adminRepository.save(admin);
  }

  async updateAdmin(
    id: number,
    payload: Partial<
      Pick<
        AdminEntity,
        "firstName" | "lastName" | "email" | "role" | "isActive"
      >
    >,
    requestId: string,
  ): Promise<void> {
    this.logger.debug("Updating admin", "AdminRepository", requestId, {
      adminId: id,
      fields: Object.keys(payload),
    });

    await this.adminRepository.update({ id }, payload);
  }

  async deleteAdmin(id: number, requestId: string): Promise<void> {
    this.logger.debug("Deleting admin", "AdminRepository", requestId, {
      adminId: id,
    });

    await this.adminRepository.delete({ id });
  }

  async findAll(
    pagination: AdminUserQueryDto,
    requestId: string,
  ): Promise<{ admins: AdminEntity[]; total: number }> {
    this.logger.debug("Listing all admins", "AdminRepository", requestId);

    const skip = (pagination.page - 1) * pagination.limit;

    const queryBuilder = this.adminRepository.createQueryBuilder("admin");

    if (pagination.isActive !== undefined) {
      queryBuilder.andWhere("admin.isActive = :isActive", {
        isActive: pagination.isActive,
      });
    }

    if (pagination.search) {
      queryBuilder.andWhere(
        "(CAST(admin.id AS TEXT) ILIKE :search OR admin.firstName ILIKE :search OR admin.lastName ILIKE :search OR admin.email ILIKE :search)",
        { search: `%${pagination.search}%` },
      );
    }

    queryBuilder
      .orderBy("admin.createdAt", "DESC")
      .skip(skip)
      .take(pagination.limit);

    const [admins, total] = await queryBuilder.getManyAndCount();

    return { admins, total };
  }

  async replaceAdminAccessControls(
    adminId: number,
    controls: Array<{ asset: PlatformAsset; access: AccessAction[] }>,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Replacing admin access controls",
      "AdminRepository",
      requestId,
      {
        adminId,
        controlCount: controls.length,
      },
    );

    await this.platformAccessControlRepository.delete({ adminId });

    const flattened = controls.flatMap((control) =>
      control.access.map((accessAction) => ({
        adminId,
        asset: control.asset,
        accessAction,
      })),
    );

    if (flattened.length === 0) {
      return;
    }

    const deduped = Array.from(
      new Map(
        flattened.map((entry) => [
          `${entry.adminId}:${entry.asset}:${entry.accessAction}`,
          entry,
        ]),
      ).values(),
    );

    await this.platformAccessControlRepository.save(
      this.platformAccessControlRepository.create(deduped),
    );
  }

  async findAdminAccessControls(
    adminId: number,
    requestId: string,
  ): Promise<Array<{ asset: PlatformAsset; access: AccessAction[] }>> {
    this.logger.debug(
      "Finding admin access controls",
      "AdminRepository",
      requestId,
      {
        adminId,
      },
    );

    const rows = await this.platformAccessControlRepository.find({
      where: { adminId },
    });

    const grouped = new Map<PlatformAsset, Set<AccessAction>>();
    for (const row of rows) {
      const existing = grouped.get(row.asset);
      if (!existing) {
        grouped.set(row.asset, new Set([row.accessAction]));
        continue;
      }

      existing.add(row.accessAction);
    }

    return Array.from(grouped.entries()).map(([asset, accessSet]) => ({
      asset,
      access: Array.from(accessSet),
    }));
  }
}
