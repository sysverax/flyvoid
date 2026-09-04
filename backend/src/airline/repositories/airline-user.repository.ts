import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import {
  AccessAction,
  AirlineAsset,
} from "../../common/constants/access-control.constants";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AirlineRole } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import { AirlineAccessControlEntity } from "../entities/airline-access-control.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";

@Injectable()
export class AirlineUserRepository {
  constructor(
    @InjectRepository(AirlineUserEntity)
    private readonly airlineUserRepository: Repository<AirlineUserEntity>,
    @InjectRepository(AirlineAccessControlEntity)
    private readonly airlineAccessControlRepository: Repository<AirlineAccessControlEntity>,
    private readonly logger: LoggerService,
  ) {}

  async findById(
    id: number,
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by id",
      "AirlineUserRepository",
      requestId,
      {
        airlineUserId: id,
      },
    );

    const repository = manager
      ? manager.getRepository(AirlineUserEntity)
      : this.airlineUserRepository;

    return repository.findOne({ where: { id } });
  }

  async findByEmail(
    email: string,
    requestId: string,
    manager?: EntityManager,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline user by email",
      "AirlineUserRepository",
      requestId,
      {
        email,
      },
    );

    const repository = manager
      ? manager.getRepository(AirlineUserEntity)
      : this.airlineUserRepository;

    return repository.findOne({ where: { email } });
  }

  async createAirlineUserWithAccessControls(
    payload: Pick<
      AirlineUserEntity,
      | "airlineId"
      | "firstName"
      | "lastName"
      | "email"
      | "jobTitle"
      | "passwordHash"
      | "role"
      | "isActive"
      | "requirePasswordReset"
    >,
    controls: Array<{ asset: AirlineAsset; access: AccessAction[] }>,
    requestId: string,
    manager: EntityManager,
  ): Promise<AirlineUserEntity> {
    this.logger.debug(
      "Creating airline user",
      "AirlineUserRepository",
      requestId,
      {
        email: payload.email,
        airlineId: payload.airlineId,
      },
    );

    const airlineUserRepository = manager.getRepository(AirlineUserEntity);
    const airlineAccessControlRepository = manager.getRepository(
      AirlineAccessControlEntity,
    );

    const airlineUser = await airlineUserRepository.save(
      airlineUserRepository.create(payload),
    );
    const flattened = controls.flatMap((control) =>
      control.access.map((accessAction) => ({
        airlineUserId: airlineUser.id,
        asset: control.asset,
        accessAction,
      })),
    );

    if (flattened.length > 0) {
      const deduped = Array.from(
        new Map(
          flattened.map((entry) => [
            `${entry.airlineUserId}:${entry.asset}:${entry.accessAction}`,
            entry,
          ]),
        ).values(),
      );

      await airlineAccessControlRepository.save(
        airlineAccessControlRepository.create(deduped),
      );
    }

    return airlineUser;
  }

  async updateAirlineUser(
    id: number,
    payload: Partial<
      Pick<
        AirlineUserEntity,
        "firstName" | "lastName" | "email" | "jobTitle" | "role" | "isActive"
      >
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug(
      "Updating airline user",
      "AirlineUserRepository",
      requestId,
      {
        airlineUserId: id,
        fields: Object.keys(payload),
      },
    );

    const repository = manager
      ? manager.getRepository(AirlineUserEntity)
      : this.airlineUserRepository;

    await repository.update({ id }, payload);
  }

  async deleteAirlineUser(id: number, requestId: string): Promise<void> {
    this.logger.debug(
      "Deleting airline user",
      "AirlineUserRepository",
      requestId,
      {
        airlineUserId: id,
      },
    );

    await this.airlineUserRepository.delete({ id });
  }

  async findAllByAirlineId(
    airlineId: number,
    pagination: PaginationQueryDto,
    requestId: string,
  ): Promise<{ users: AirlineUserEntity[]; total: number }> {
    this.logger.debug(
      "Listing airline users by airline id",
      "AirlineUserRepository",
      requestId,
      {
        airlineId,
        page: pagination.page,
        limit: pagination.limit,
      },
    );

    const skip = (pagination.page - 1) * pagination.limit;

    const [users, total] = await this.airlineUserRepository.findAndCount({
      where: { airlineId },
      order: {
        createdAt: "DESC",
      },
      skip,
      take: pagination.limit,
    });

    return { users, total };
  }

  async replaceAirlineAccessControls(
    airlineUserId: number,
    controls: Array<{ asset: AirlineAsset; access: AccessAction[] }>,
    requestId: string,
  ): Promise<void> {
    this.logger.debug(
      "Replacing airline user access controls",
      "AirlineUserRepository",
      requestId,
      {
        airlineUserId,
        controlCount: controls.length,
      },
    );

    await this.airlineAccessControlRepository.delete({ airlineUserId });

    const flattened = controls.flatMap((control) =>
      control.access.map((accessAction) => ({
        airlineUserId,
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
          `${entry.airlineUserId}:${entry.asset}:${entry.accessAction}`,
          entry,
        ]),
      ).values(),
    );

    await this.airlineAccessControlRepository.save(
      this.airlineAccessControlRepository.create(deduped),
    );
  }
  async findAirlineUserAccessControls(
    airlineUserId: number,
    requestId: string,
  ): Promise<Array<{ asset: AirlineAsset; access: AccessAction[] }>> {
    this.logger.debug(
      "Finding airline access controls",
      "AirlineUserRepository",
      requestId,
      {
        airlineUserId,
      },
    );

    const rows = await this.airlineAccessControlRepository.find({
      where: { airlineUserId },
    });

    const grouped = new Map<AirlineAsset, Set<AccessAction>>();
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

  async findAdminByAirlineId(
    airlineId: number,
    requestId: string,
  ): Promise<AirlineUserEntity | null> {
    this.logger.debug(
      "Finding airline admin user by airline id",
      "AirlineUserRepository",
      requestId,
      { airlineId },
    );

    return this.airlineUserRepository.findOne({
      where: { airlineId, role: AirlineRole.AIRLINE_ADMIN },
    });
  }

  async countActiveAirlineAdminsByAirlineId(
    airlineId: number,
    requestId: string,
  ): Promise<number> {
    this.logger.debug(
      "Counting airline admins by airline id",
      "AirlineUserRepository",
      requestId,
      { airlineId },
    );

    return this.airlineUserRepository.count({
      where: {
        airlineId,
        role: AirlineRole.AIRLINE_ADMIN,
        isActive: true,
      },
    });
  }
}
