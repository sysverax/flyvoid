import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import {
  AccessAction,
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { LoggerService } from "../../common/logger/logger.service";
import { JwtAccessPayload } from "../../auth/interfaces/jwt-access-payload.interface";
import { AdminRole } from "../../common/constants/user.constants";
import {
  AdminProfileDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
  InviteAdminUserRequestDto,
  InviteAdminUserResponseDto,
  UpdateAdminUserRequestDto,
} from "../dto";
import { AdminRepository } from "../repositories/admin.repository";

@Injectable()
export class AdminService {
  private readonly context = "AdminService";

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly logger: LoggerService,
  ) {}

  async getLoggedInAdminProfile(
    authenticatedUser: JwtAccessPayload,
    requestId: string,
  ): Promise<AdminProfileDto> {
    const adminId = authenticatedUser.sub;

    this.logger.info(
      "Fetch logged-in admin profile attempt",
      this.context,
      requestId,
      {
        adminId,
      },
    );

    const admin = await this.adminRepository.findById(adminId, requestId);
    if (!admin || !admin.isActive) {
      this.logger.warn(
        "Logged-in admin profile fetch unauthorized",
        this.context,
        requestId,
        {
          adminId,
        },
      );
      throw new UnauthorizedException("Unauthorized");
    }

    this.logger.info(
      "Fetch logged-in admin profile success",
      this.context,
      requestId,
      {
        adminId,
      },
    );

    const accessControls =
      admin.role === AdminRole.SUPER_ADMIN
        ? this.buildSuperAdminAccessControls()
        : await this.adminRepository.findAdminAccessControls(
            admin.id,
            requestId,
          );

    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      accessControls,
    };
  }

  async inviteAdminUser(
    authenticatedUser: JwtAccessPayload,
    dto: InviteAdminUserRequestDto,
    requestId: string,
  ): Promise<InviteAdminUserResponseDto> {
    await this.ensureSuperAdmin(authenticatedUser, requestId);

    if (dto.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException("Inviting SUPER_ADMIN is not allowed");
    }

    const email = dto.email.toLowerCase().trim();
    const existingAdmin = await this.adminRepository.findByEmail(
      email,
      requestId,
    );
    if (existingAdmin) {
      throw new ConflictException("Admin email already exists");
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const createdAdmin = await this.adminRepository.createAdmin(
      {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        passwordHash,
        role: dto.role,
        isActive: dto.isActive ?? true,
        requirePasswordReset: true,
      },
      requestId,
    );

    await this.adminRepository.replaceAdminAccessControls(
      createdAdmin.id,
      this.normalizePlatformAccessControls(dto.accessControls),
      requestId,
    );

    this.logger.info("Admin invited successfully", this.context, requestId, {
      adminId: createdAdmin.id,
      email,
      role: createdAdmin.role,
    });

    return {
      admin: this.toAdminUserResponse(createdAdmin),
      temporaryPassword,
    };
  }

  async updateAdminUser(
    authenticatedUser: JwtAccessPayload,
    adminId: number,
    dto: UpdateAdminUserRequestDto,
    requestId: string,
  ): Promise<AdminUserResponseDto> {
    const actor = await this.ensureSuperAdmin(authenticatedUser, requestId);

    const admin = await this.adminRepository.findById(adminId, requestId);
    if (!admin) {
      throw new NotFoundException("Admin user not found");
    }

    if (admin.role === AdminRole.SUPER_ADMIN && actor.id !== admin.id) {
      throw new ForbiddenException(
        "Only self-update is allowed for SUPER_ADMIN",
      );
    }

    if (
      dto.role === AdminRole.SUPER_ADMIN &&
      admin.role !== AdminRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        "Updating role to SUPER_ADMIN is not allowed",
      );
    }

    if (dto.email) {
      const existingByEmail = await this.adminRepository.findByEmail(
        dto.email,
        requestId,
      );
      if (existingByEmail && existingByEmail.id !== admin.id) {
        throw new ConflictException("Admin email already exists");
      }
    }

    if (admin.role === AdminRole.SUPER_ADMIN && dto.isActive === false) {
      throw new ForbiddenException("SUPER_ADMIN cannot be suspended");
    }

    await this.adminRepository.updateAdmin(
      adminId,
      {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        email: dto.email,
        role: dto.role,
        isActive: dto.isActive,
      },
      requestId,
    );

    if (dto.accessControls) {
      await this.adminRepository.replaceAdminAccessControls(
        adminId,
        this.normalizePlatformAccessControls(dto.accessControls),
        requestId,
      );
    }

    const updated = await this.adminRepository.findById(adminId, requestId);
    if (!updated) {
      throw new NotFoundException("Admin user not found");
    }

    return this.toAdminUserResponse(updated);
  }

  async deleteAdminUser(
    authenticatedUser: JwtAccessPayload,
    adminId: number,
    requestId: string,
  ): Promise<void> {
    const actor = await this.ensureSuperAdmin(authenticatedUser, requestId);

    const admin = await this.adminRepository.findById(adminId, requestId);
    if (!admin) {
      throw new NotFoundException("Admin user not found");
    }

    if (admin.id === actor.id) {
      throw new ForbiddenException("You cannot delete your own account");
    }

    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException("Deleting SUPER_ADMIN is not allowed");
    }

    await this.adminRepository.deleteAdmin(adminId, requestId);
  }

  async listAdminUsers(
    authenticatedUser: JwtAccessPayload,
    pagination: PaginationQueryDto,
    requestId: string,
  ): Promise<AdminUserListResponseDto> {
    await this.ensureSuperAdmin(authenticatedUser, requestId);

    const { admins, total } = await this.adminRepository.findAll(
      pagination,
      requestId,
    );

    return {
      total,
      currentPage: pagination.page,
      limit: pagination.limit,
      users: admins.map((admin) => this.toAdminUserResponse(admin)),
    };
  }

  private async ensureSuperAdmin(
    authenticatedUser: JwtAccessPayload,
    requestId: string,
  ) {
    const actor = await this.adminRepository.findById(
      authenticatedUser.sub,
      requestId,
    );
    if (!actor || !actor.isActive) {
      throw new UnauthorizedException("Unauthorized");
    }

    if (actor.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only SUPER_ADMIN can perform this action");
    }

    return actor;
  }

  private toAdminUserResponse(admin: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }): AdminUserResponseDto {
    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    };
  }

  private generateTemporaryPassword(length = 12): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnpqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%^&*";
    const all = upper + lower + digits + symbols;

    const pick = (pool: string) =>
      pool[Math.floor(Math.random() * pool.length)];

    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < length) {
      chars.push(pick(all));
    }

    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join("");
  }

  private normalizePlatformAccessControls(
    controls: Array<{ asset: PlatformAsset; access: AccessAction[] }>,
  ): Array<{ asset: PlatformAsset; access: AccessAction[] }> {
    const grouped = new Map<PlatformAsset, Set<AccessAction>>();

    for (const control of controls) {
      const normalizedActions = this.withImpliedView(control.access);
      const existing = grouped.get(control.asset);
      if (!existing) {
        grouped.set(control.asset, new Set(normalizedActions));
        continue;
      }

      for (const action of normalizedActions) {
        existing.add(action);
      }
    }

    return Array.from(grouped.entries()).map(([asset, actionSet]) => ({
      asset,
      access: Array.from(actionSet),
    }));
  }

  private withImpliedView(access: AccessAction[]): AccessAction[] {
    const actionSet = new Set(access);

    if (
      actionSet.has(AccessAction.EDIT) ||
      actionSet.has(AccessAction.DELETE) ||
      actionSet.has(AccessAction.EXPORT)
    ) {
      actionSet.add(AccessAction.VIEW);
    }

    return Array.from(actionSet);
  }

  private buildSuperAdminAccessControls(): Array<{
    asset: PlatformAsset;
    access: AccessAction[];
  }> {
    const allActions = Object.values(AccessAction);

    return Object.values(PlatformAsset).map((asset) => ({
      asset,
      access: allActions,
    }));
  }
}
