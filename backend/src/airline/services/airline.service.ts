import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthenticatedUser } from "../../auth/interfaces/authenticated-request.interface";
import {
  AccessAction,
  AirlineAsset,
} from "../../common/constants/access-control.constants";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AirlineRole, UserType } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import {
  AirlineProfileResponseDto,
  AirlineUserListResponseDto,
  AirlineUserResponseDto,
  AirlineUserProfileResponseDto,
  InviteAirlineUserRequestDto,
  InviteAirlineUserResponseDto,
  UpdateAirlineUserRequestDto,
} from "../dto";
import { AirlineEntity } from "../entities/airline.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";
import { AirlineUserRepository } from "../repositories/airline-user.repository";

@Injectable()
export class AirlineService {
  private readonly context = "AirlineService";

  constructor(
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    private readonly airlineUserRepository: AirlineUserRepository,
    private readonly logger: LoggerService,
  ) {}

  async inviteAirlineUser(
    authenticatedUser: AuthenticatedUser,
    dto: InviteAirlineUserRequestDto,
    requestId: string,
  ): Promise<InviteAirlineUserResponseDto> {
    const actor = await this.ensureAirlineAdmin(authenticatedUser, requestId);

    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.airlineUserRepository.findByEmail(
      email,
      requestId,
    );
    if (existingUser) {
      throw new ConflictException("Airline user email already exists");
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const createdUser = await this.airlineUserRepository.create(
      {
        airlineId: actor.airlineId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        jobTitle: dto.jobTitle.trim(),
        passwordHash,
        role: AirlineRole.AIRLINE_STAFF,
        isActive: dto.isActive ?? true,
        requirePasswordReset: true,
      },
      requestId,
      this.airlineRepository.manager,
    );

    await this.airlineUserRepository.replaceAirlineAccessControls(
      createdUser.id,
      this.normalizeAirlineAccessControls(dto.accessControls),
      requestId,
    );

    this.logger.info(
      "Airline user invited successfully",
      this.context,
      requestId,
      {
        airlineUserId: createdUser.id,
        airlineId: createdUser.airlineId,
        email,
        role: createdUser.role,
      },
    );

    return {
      user: this.toAirlineUserResponse(createdUser),
      temporaryPassword,
    };
  }

  async updateAirlineUser(
    authenticatedUser: AuthenticatedUser,
    userId: number,
    dto: UpdateAirlineUserRequestDto,
    requestId: string,
  ): Promise<AirlineUserResponseDto> {
    const actor = await this.ensureAirlineAdmin(authenticatedUser, requestId);

    const user = await this.airlineUserRepository.findById(userId, requestId);
    if (!user || user.airlineId !== actor.airlineId) {
      throw new NotFoundException("Airline user not found");
    }

    if (user.role === AirlineRole.AIRLINE_ADMIN && actor.id !== user.id) {
      throw new ForbiddenException(
        "Only self-update is allowed for AIRLINE_ADMIN",
      );
    }

    if (user.role === AirlineRole.AIRLINE_ADMIN && dto.isActive === false) {
      throw new ForbiddenException("AIRLINE_ADMIN cannot be suspended");
    }

    await this.airlineUserRepository.updateAirlineUser(
      userId,
      {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        jobTitle: dto.jobTitle?.trim(),
        isActive: dto.isActive,
      },
      requestId,
    );

    if (dto.accessControls) {
      await this.airlineUserRepository.replaceAirlineAccessControls(
        userId,
        this.normalizeAirlineAccessControls(dto.accessControls),
        requestId,
      );
    }

    const updated = await this.airlineUserRepository.findById(
      userId,
      requestId,
    );
    if (!updated || updated.airlineId !== actor.airlineId) {
      throw new NotFoundException("Airline user not found");
    }

    return this.toAirlineUserResponse(updated);
  }

  async deleteAirlineUser(
    authenticatedUser: AuthenticatedUser,
    userId: number,
    requestId: string,
  ): Promise<void> {
    const actor = await this.ensureAirlineAdmin(authenticatedUser, requestId);

    const user = await this.airlineUserRepository.findById(userId, requestId);
    if (!user || user.airlineId !== actor.airlineId) {
      throw new NotFoundException("Airline user not found");
    }

    if (user.id === actor.id) {
      throw new ForbiddenException("You cannot delete your own account");
    }

    if (user.role === AirlineRole.AIRLINE_ADMIN) {
      throw new ForbiddenException("Deleting AIRLINE_ADMIN is not allowed");
    }

    await this.airlineUserRepository.deleteAirlineUser(userId, requestId);
  }

  async listAirlineUsers(
    authenticatedUser: AuthenticatedUser,
    pagination: PaginationQueryDto,
    requestId: string,
  ): Promise<AirlineUserListResponseDto> {
    const actor = await this.ensureAirlineAdmin(authenticatedUser, requestId);

    const { users, total } =
      await this.airlineUserRepository.findAllByAirlineId(
        actor.airlineId,
        pagination,
        requestId,
      );

    return {
      total,
      currentPage: pagination.page,
      limit: pagination.limit,
      users: users.map((user) => this.toAirlineUserResponse(user)),
    };
  }

  async getUserProfile(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AirlineUserProfileResponseDto> {
    const user = await this.requireAirlineUser(authenticatedUser, requestId);

    return {
      id: user.id,
      airlineId: user.airlineId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
  }

  async getAirlineProfile(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AirlineProfileResponseDto> {
    const user = await this.requireAirlineUser(authenticatedUser, requestId);

    const airline = await this.airlineRepository.findOne({
      where: { id: user.airlineId, isActive: true },
    });

    if (!airline) {
      throw new UnauthorizedException("Airline not found");
    }

    return {
      id: airline.id,
      name: airline.name,
      code: airline.code,
      countryCode: airline.countryCode,
      contactEmail: airline.contactEmail ?? null,
      contactPhone: airline.contactPhone ?? null,
    };
  }

  private async requireAirlineUser(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AirlineUserEntity> {
    if (authenticatedUser.userType !== UserType.AIRLINE) {
      throw new UnauthorizedException("Unauthorized");
    }

    const user = await this.airlineUserRepository.findById(
      authenticatedUser.sub,
      requestId,
    );

    if (!user || !user.isActive) {
      this.logger.warn("Airline user not found", this.context, requestId, {
        airlineUserId: authenticatedUser.sub,
      });
      throw new UnauthorizedException("Airline user not found");
    }

    return user;
  }

  private async ensureAirlineAdmin(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
  ): Promise<AirlineUserEntity> {
    const actor = await this.airlineUserRepository.findById(
      authenticatedUser.sub,
      requestId,
    );

    if (!actor || !actor.isActive) {
      throw new UnauthorizedException("Unauthorized");
    }

    if (actor.role !== AirlineRole.AIRLINE_ADMIN) {
      throw new ForbiddenException(
        "Only AIRLINE_ADMIN can perform this action",
      );
    }

    return actor;
  }

  private toAirlineUserResponse(user: {
    id: number;
    airlineId: number;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
    role: AirlineRole;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }): AirlineUserResponseDto {
    return {
      id: user.id,
      airlineId: user.airlineId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      jobTitle: user.jobTitle,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
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

  private normalizeAirlineAccessControls(
    controls: Array<{ asset: AirlineAsset; access: AccessAction[] }>,
  ): Array<{ asset: AirlineAsset; access: AccessAction[] }> {
    const grouped = new Map<AirlineAsset, Set<AccessAction>>();

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
      actionSet.has(AccessAction.EXPORT)
    ) {
      actionSet.add(AccessAction.VIEW);
    }

    return Array.from(actionSet);
  }
}
