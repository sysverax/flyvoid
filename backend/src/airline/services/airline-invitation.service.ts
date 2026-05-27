import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { DataSource, EntityManager } from "typeorm";
import { AuthenticatedUser } from "../../auth/interfaces/authenticated-request.interface";
import {
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
} from "../../auth/dto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { LoggerService } from "../../common/logger/logger.service";
import { config } from "../../config/config";
import {
  AirlineInvitationListResponseDto,
  AirlineInvitationMatrixResponseDto,
  AirlineInvitationResponseDto,
  AirlineInvitationDetailResponseDto,
  ResendAirlineInvitationResponseDto,
  RevokeAirlineInvitationResponseDto,
} from "../dto/airline-invitation";
import { AirlineAdminInviteEntity } from "../entities/airline-admin-invite.entity";
import { AIRLINE_INVITATION_STATUSES } from "../utils";
import { AIRLINE_INVITATION_HISTORY_EVENTS } from "../entities/airline-admin-invite-history.entity";
import { AirlineInvitationRepository } from "../repositories/airline-invitation.repository";

@Injectable()
export class AirlineInvitationService {
  private readonly context = "AirlineInvitationService";
  private readonly sesClient = new SESClient({
    region: config.ses.region,
    credentials: {
      accessKeyId: config.ses.accessKeyId,
      secretAccessKey: config.ses.secretAccessKey,
    },
  });

  constructor(
    private readonly airlineInvitationRepository: AirlineInvitationRepository,
    private readonly logger: LoggerService,
    private readonly dataSource: DataSource,
  ) {}

  async inviteAirlineAdmin(
    authenticatedUser: AuthenticatedUser,
    dto: AdminInviteAirlineAdminRequestDto,
    requestId: string,
  ): Promise<AdminInviteAirlineAdminResponseDto> {
    const normalizedAirlineCode = dto.airlineCode.trim().toUpperCase();
    const normalizedCompanyRegistrationNumber =
      dto.companyRegistrationNumber.trim();
    const normalizedAdminEmail = dto.adminEmail.toLowerCase().trim();
    const normalizedContactEmail =
      dto.contactEmail?.toLowerCase().trim() ?? null;

    const existingAirline =
      await this.airlineInvitationRepository.findAirlineByCodeOrCompanyRegistrationNumber(
        normalizedAirlineCode,
        normalizedCompanyRegistrationNumber,
        requestId,
      );
    if (existingAirline?.code === normalizedAirlineCode) {
      throw new ConflictException("Airline code already exists");
    }
    if (
      existingAirline?.companyRegistrationNumber ===
      normalizedCompanyRegistrationNumber
    ) {
      throw new ConflictException("Company registration number already exists");
    }

    const existingAirlineUser =
      await this.airlineInvitationRepository.findAirlineUserByEmail(
        normalizedAdminEmail,
        requestId,
      );
    if (existingAirlineUser) {
      throw new ConflictException("Airline admin email already exists");
    }

    const activeInviteByEmail =
      await this.airlineInvitationRepository.findActiveAirlineAdminInviteByEmail(
        normalizedAdminEmail,
        requestId,
      );
    if (activeInviteByEmail) {
      throw new ConflictException(
        "Active invitation already exists for this email",
      );
    }

    const activeMetaByIdentity =
      await this.airlineInvitationRepository.findActiveMetaInviteByCodeOrCompanyRegistrationNumber(
        normalizedAirlineCode,
        normalizedCompanyRegistrationNumber,
        requestId,
      );

    if (activeMetaByIdentity?.airlineCode === normalizedAirlineCode) {
      throw new ConflictException(
        "Active invitation already exists for this airline code",
      );
    }

    if (
      activeMetaByIdentity?.companyRegistrationNumber ===
      normalizedCompanyRegistrationNumber
    ) {
      throw new ConflictException(
        "Active invitation already exists for this company registration number",
      );
    }

    const { invite, onboardingLink } = await this.dataSource.transaction(
      async (manager) => {
        const meta =
          await this.airlineInvitationRepository.createMetaAirlineInvite(
            {
              airlineName: dto.airlineName.trim(),
              airlineCode: normalizedAirlineCode,
              countryCode: dto.countryCode,
              companyRegistrationNumber: normalizedCompanyRegistrationNumber,
              website: dto.website?.trim() ?? undefined,
              contactEmail: dto.contactEmail.trim(),
              contactPhone: dto.contactPhone.trim(),
              timezone: dto.timezone.trim(),
              currency: dto.currency.trim().toUpperCase(),
              address: dto.address.trim(),
              logo: dto.logo?.trim() ?? undefined,
              adminFirstName: dto.adminFirstName.trim(),
              adminLastName: dto.adminLastName.trim(),
              adminEmail: normalizedAdminEmail,
              adminJobTitle: dto.jobTitle.trim(),
            },
            requestId,
            manager,
          );

        return this.createInvitation(
          {
            metaId: meta.id,
            invitedByAdminId: authenticatedUser.sub,
          },
          requestId,
          manager,
        );
      },
    );

    if (this.isOtpRestrictedEnvironment()) {
      this.logger.info(
        "Airline admin invitation generated in non-production mode",
        this.context,
        requestId,
        {
          inviteId: invite.id,
          email: normalizedAdminEmail,
          onboardingLink,
        },
      );
    } else {
      await this.sendAirlineAdminInviteEmail(
        normalizedAdminEmail,
        onboardingLink,
        dto.airlineName,
        requestId,
      );
    }

    return {
      invitationId: invite.id,
      airlineId: null,
      airlineName: dto.airlineName.trim(),
      airlineCode: normalizedAirlineCode,
      companyRegistrationNumber: normalizedCompanyRegistrationNumber,
      website: dto.website?.trim() ?? undefined,
      contactEmail: normalizedContactEmail,
      contactPhone: dto.contactPhone.trim(),
      timezone: dto.timezone.trim(),
      currency: dto.currency.trim().toUpperCase(),
      address: dto.address.trim(),
      logo: dto.logo?.trim() ?? undefined,
      firstName: dto.adminFirstName.trim(),
      lastName: dto.adminLastName.trim(),
      email: normalizedAdminEmail,
      jobTitle: dto.jobTitle.trim(),
      expiresIn: config.auth.airlineAdminInviteExpiresIn,
      onboardingLink: this.isOtpRestrictedEnvironment()
        ? onboardingLink
        : undefined,
    };
  }

  async listInvitations(
    pagination: PaginationQueryDto,
    requestId: string,
  ): Promise<AirlineInvitationListResponseDto> {
    const { invitations, total } =
      await this.airlineInvitationRepository.findAllInvitations(
        pagination,
        requestId,
      );

    return {
      total,
      currentPage: pagination.page,
      limit: pagination.limit,
      invitations: invitations.map((invite) =>
        this.toInvitationResponse(invite),
      ),
    };
  }

  async resendInvitation(
    authenticatedUser: AuthenticatedUser,
    invitationId: number,
    requestId: string,
  ): Promise<ResendAirlineInvitationResponseDto> {
    const invite =
      await this.airlineInvitationRepository.findAirlineAdminInviteById(
        invitationId,
        requestId,
      );

    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }

    if (invite.status === AIRLINE_INVITATION_STATUSES.ACCEPTED) {
      throw new ConflictException("Accepted invitation cannot be resent");
    }

    const { invitationToken, tokenLookup, tokenHash, expiresAt } =
      await this.generateInvitationTokenData();

    await this.airlineInvitationRepository.refreshAirlineAdminInvite(
      invite.id,
      {
        invitedByAdminId: authenticatedUser.sub,
        tokenLookup,
        tokenHash,
        expiresAt,
        status: AIRLINE_INVITATION_STATUSES.PENDING,
        acceptedAt: null,
        revokedAt: null,
      },
      requestId,
    );

    await this.airlineInvitationRepository.recordInvitationHistory(
      {
        invitationId: invite.id,
        event: AIRLINE_INVITATION_HISTORY_EVENTS.RESENT,
        performedByAdminId: authenticatedUser.sub,
      },
      requestId,
    );

    const onboardingLink = `${config.auth.airlineAdminOnboardingBaseUrl}?token=${invitationToken}`;

    const airlineName =
      invite.meta?.airlineName ?? invite.airline?.name ?? "Airline";
    const inviteEmail = invite.meta?.adminEmail;
    if (!inviteEmail) {
      throw new BadRequestException("Invitation metadata not found");
    }

    if (this.isOtpRestrictedEnvironment()) {
      this.logger.info(
        "Airline invitation resent in non-production mode",
        this.context,
        requestId,
        {
          invitationId: invite.id,
          email: inviteEmail,
          onboardingLink,
        },
      );
    } else {
      await this.sendAirlineAdminInviteEmail(
        inviteEmail,
        onboardingLink,
        airlineName,
        requestId,
      );
    }

    return {
      invitationId: invite.id,
      expiresIn: config.auth.airlineAdminInviteExpiresIn,
      onboardingLink: this.isOtpRestrictedEnvironment()
        ? onboardingLink
        : undefined,
    };
  }

  async revokeInvitation(
    authenticatedUser: AuthenticatedUser,
    invitationId: number,
    requestId: string,
  ): Promise<RevokeAirlineInvitationResponseDto> {
    const invite =
      await this.airlineInvitationRepository.findAirlineAdminInviteById(
        invitationId,
        requestId,
      );

    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }

    if (invite.status === AIRLINE_INVITATION_STATUSES.ACCEPTED) {
      throw new ConflictException("Accepted invitation cannot be revoked");
    }

    if (invite.status !== AIRLINE_INVITATION_STATUSES.REVOKED) {
      await this.airlineInvitationRepository.revokeAirlineAdminInvite(
        invite.id,
        requestId,
      );

      await this.airlineInvitationRepository.recordInvitationHistory(
        {
          invitationId: invite.id,
          event: AIRLINE_INVITATION_HISTORY_EVENTS.REVOKED,
          performedByAdminId: authenticatedUser.sub,
        },
        requestId,
      );
    }

    return {
      invitationId: invite.id,
      status: AIRLINE_INVITATION_STATUSES.REVOKED,
    };
  }

  async getInvitation(
    invitationId: number,
    requestId: string,
  ): Promise<AirlineInvitationDetailResponseDto> {
    const invite =
      await this.airlineInvitationRepository.findAirlineAdminInviteByIdWithHistory(
        invitationId,
        requestId,
      );

    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }

    // When accepted, the airline record is the live source of truth — it may
    // have been updated after onboarding. Fall back to meta (snapshot at invite
    // time) only if the airline relation is absent.
    const airline = invite.airline;
    const meta = invite.meta;

    return {
      invitationId: invite.id,
      airlineId: invite.airlineId,
      airlineName: airline?.name ?? meta?.airlineName ?? "",
      airlineCode: airline?.code ?? meta?.airlineCode ?? "",
      companyRegistrationNumber:
        airline?.companyRegistrationNumber ??
        meta?.companyRegistrationNumber ??
        "",
      firstName: meta?.adminFirstName ?? "",
      lastName: meta?.adminLastName ?? "",
      email: meta?.adminEmail ?? "",
      jobTitle: meta?.adminJobTitle ?? "",
      invitedByAdminId: invite.invitedByAdminId,
      status: this.resolveInvitationStatus(invite),
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
      history: (invite.history ?? []).map((h) => ({
        id: h.id,
        event: h.event,
        performedByAdminId: h.performedByAdminId,
        performedByAdminEmail: h.performedByAdmin?.email ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async getInvitationMatrix(
    requestId: string,
  ): Promise<AirlineInvitationMatrixResponseDto> {
    return this.airlineInvitationRepository.getInvitationMatrix(requestId);
  }

  private toInvitationResponse(
    invite: AirlineAdminInviteEntity,
  ): AirlineInvitationResponseDto {
    return {
      invitationId: invite.id,
      airlineId: invite.airlineId,
      airlineName: invite.meta?.airlineName ?? invite.airline?.name ?? "",
      airlineCode: invite.meta?.airlineCode ?? invite.airline?.code ?? "",
      firstName: invite.meta?.adminFirstName ?? "",
      lastName: invite.meta?.adminLastName ?? "",
      email: invite.meta?.adminEmail ?? "",
      jobTitle: invite.meta?.adminJobTitle ?? "",
      invitedByAdminId: invite.invitedByAdminId,
      status: this.resolveInvitationStatus(invite),
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
    };
  }

  private resolveInvitationStatus(
    invite: AirlineAdminInviteEntity,
  ): AIRLINE_INVITATION_STATUSES {
    if (invite.status === AIRLINE_INVITATION_STATUSES.ACCEPTED) {
      return AIRLINE_INVITATION_STATUSES.ACCEPTED;
    }

    if (invite.status === AIRLINE_INVITATION_STATUSES.REVOKED) {
      return AIRLINE_INVITATION_STATUSES.REVOKED;
    }

    if (
      invite.status === AIRLINE_INVITATION_STATUSES.PENDING &&
      invite.expiresAt.getTime() <= Date.now()
    ) {
      return AIRLINE_INVITATION_STATUSES.EXPIRED;
    }

    return AIRLINE_INVITATION_STATUSES.PENDING;
  }

  private async createInvitation(
    payload: {
      metaId: number;
      invitedByAdminId: number;
    },
    requestId: string,
    manager?: EntityManager,
  ): Promise<{ invite: AirlineAdminInviteEntity; onboardingLink: string }> {
    const { invitationToken, tokenLookup, tokenHash, expiresAt } =
      await this.generateInvitationTokenData();

    const invite =
      await this.airlineInvitationRepository.createAirlineAdminInvite(
        {
          metaId: payload.metaId,
          airlineId: null,
          invitedByAdminId: payload.invitedByAdminId,
          tokenLookup,
          tokenHash,
          expiresAt,
          status: AIRLINE_INVITATION_STATUSES.PENDING,
          acceptedAt: null,
          revokedAt: null,
        },
        requestId,
        manager,
      );

    await this.airlineInvitationRepository.recordInvitationHistory(
      {
        invitationId: invite.id,
        event: AIRLINE_INVITATION_HISTORY_EVENTS.SENT,
        performedByAdminId: payload.invitedByAdminId,
      },
      requestId,
      manager,
    );

    const onboardingLink = `${config.auth.airlineAdminOnboardingBaseUrl}?token=${invitationToken}`;
    return { invite, onboardingLink };
  }

  private async generateInvitationTokenData(): Promise<{
    invitationToken: string;
    tokenLookup: string;
    tokenHash: string;
    expiresAt: Date;
  }> {
    const invitationToken = crypto.randomBytes(32).toString("hex");
    const tokenLookup = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");
    const tokenHash = await bcrypt.hash(invitationToken, 10);
    const expiresAt = new Date(
      Date.now() + this.durationToMs(config.auth.airlineAdminInviteExpiresIn),
    );

    return {
      invitationToken,
      tokenLookup,
      tokenHash,
      expiresAt,
    };
  }

  private durationToMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  private isOtpRestrictedEnvironment(): boolean {
    return ["dev", "development", "local", "test", "automation_test"].includes(
      config.app.env,
    );
  }

  private async sendAirlineAdminInviteEmail(
    recipientEmail: string,
    onboardingLink: string,
    airlineName: string,
    requestId: string,
  ): Promise<void> {
    try {
      await this.sesClient.send(
        new SendEmailCommand({
          Source: config.ses.fromEmail,
          Destination: {
            ToAddresses: [recipientEmail],
          },
          Message: {
            Subject: {
              Data: "Airline admin invitation",
            },
            Body: {
              Text: {
                Data: `You have been invited as airline admin for ${airlineName}. Complete onboarding using this link: ${onboardingLink}`,
              },
            },
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        "Failed to send airline admin invite email",
        this.context,
        requestId,
        {
          recipientEmail,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }
}
