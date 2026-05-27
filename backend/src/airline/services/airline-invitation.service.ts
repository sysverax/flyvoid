import { ConflictException, Injectable } from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { AuthenticatedUser } from "../../auth/interfaces/authenticated-request.interface";
import {
  AdminInviteAirlineAdminRequestDto,
  AdminInviteAirlineAdminResponseDto,
} from "../../auth/dto";
import { LoggerService } from "../../common/logger/logger.service";
import { config } from "../../config/config";
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

    const airline = await this.airlineInvitationRepository.createAirline(
      {
        name: dto.airlineName.trim(),
        code: normalizedAirlineCode,
        countryCode: dto.countryCode,
        companyRegistrationNumber: normalizedCompanyRegistrationNumber,
        website: dto.website?.trim() ?? undefined,
        contactEmail: dto.contactEmail.trim(),
        contactPhone: dto.contactPhone.trim(),
        timezone: dto.timezone.trim(),
        currency: dto.currency.trim().toUpperCase(),
        address: dto.address.trim(),
        logo: dto.logo?.trim() ?? undefined,
        isActive: true,
      },
      requestId,
    );

    const invitationToken = crypto.randomBytes(32).toString("hex");
    const tokenLookup = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");
    const tokenHash = await bcrypt.hash(invitationToken, 10);
    const expiresAt = new Date(
      Date.now() + this.durationToMs(config.auth.airlineAdminInviteExpiresIn),
    );

    const invite =
      await this.airlineInvitationRepository.createAirlineAdminInvite(
        {
          airlineId: airline.id,
          invitedByAdminId: authenticatedUser.sub,
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          email: normalizedAdminEmail,
          jobTitle: dto.jobTitle.trim(),
          tokenLookup,
          tokenHash,
          expiresAt,
          isAccepted: false,
        },
        requestId,
      );

    const onboardingLink = `${config.auth.airlineAdminOnboardingBaseUrl}?token=${invitationToken}`;

    if (this.isOtpRestrictedEnvironment()) {
      this.logger.info(
        "Airline admin invitation generated in non-production mode",
        this.context,
        requestId,
        {
          inviteId: invite.id,
          airlineId: airline.id,
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
      airlineId: airline.id,
      airlineName: airline.name,
      airlineCode: airline.code,
      companyRegistrationNumber: airline.companyRegistrationNumber,
      website: airline.website || undefined,
      contactEmail: normalizedContactEmail,
      contactPhone: airline.contactPhone,
      timezone: airline.timezone,
      currency: airline.currency,
      address: airline.address,
      logo: airline.logo || undefined,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      jobTitle: invite.jobTitle,
      expiresIn: config.auth.airlineAdminInviteExpiresIn,
      onboardingLink: this.isOtpRestrictedEnvironment()
        ? onboardingLink
        : undefined,
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
