import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAccessPayload } from "../../auth/interfaces/jwt-access-payload.interface";
import { UserType } from "../../common/constants/user.constants";
import { LoggerService } from "../../common/logger/logger.service";
import {
  AirlineProfileResponseDto,
  AirlineUserProfileResponseDto,
} from "../dto";
import { AirlineEntity } from "../entities/airline.entity";
import { AirlineUserEntity } from "../entities/airline-user.entity";

@Injectable()
export class AirlineService {
  private readonly context = "AirlineService";

  constructor(
    @InjectRepository(AirlineEntity)
    private readonly airlineRepository: Repository<AirlineEntity>,
    @InjectRepository(AirlineUserEntity)
    private readonly airlineUserRepository: Repository<AirlineUserEntity>,
    private readonly logger: LoggerService,
  ) {}

  async getUserProfile(
    authenticatedUser: JwtAccessPayload,
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
    authenticatedUser: JwtAccessPayload,
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
    authenticatedUser: JwtAccessPayload,
    requestId: string,
  ): Promise<AirlineUserEntity> {
    if (authenticatedUser.userType !== UserType.AIRLINE) {
      throw new UnauthorizedException("Unauthorized");
    }

    const user = await this.airlineUserRepository.findOne({
      where: { id: authenticatedUser.sub, isActive: true },
    });

    if (!user) {
      this.logger.warn("Airline user not found", this.context, requestId, {
        airlineUserId: authenticatedUser.sub,
      });
      throw new UnauthorizedException("Airline user not found");
    }

    return user;
  }
}
