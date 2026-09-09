import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Logger } from "winston";
import { config } from "../config/config";
import { UserType } from "../common/constants/user.constants";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-request.interface";
import { FlightStatus } from "../cancelled-flights/entities/enums";
import { HotelAllocationEntity } from "../cancelled-flights/entities/hotel-allocation.entity";
import { HotelBookingsRepository } from "./hotel-bookings.repository";
import {
  GetHotelBookingsQueryDto,
  HotelBookingDetailResponseDto,
  HotelBookingHotelDetailDto,
  HotelBookingListResponseDto,
  SendHotelBookingEmailResponseDto,
} from "./dto";

@Injectable()
export class HotelBookingsService {
  private readonly context = "HotelBookingsService";
  private readonly sesClient = new SESClient({
    region: config.ses.region,
    credentials: {
      accessKeyId: config.ses.accessKeyId,
      secretAccessKey: config.ses.secretAccessKey,
    },
  });

  constructor(private readonly repository: HotelBookingsRepository) {}

  // ── List ─────────────────────────────────────────────────────────────────

  async listHotelBookings(
    user: AuthenticatedUser,
    query: GetHotelBookingsQueryDto,
    requestLogger: Logger,
  ): Promise<HotelBookingListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    requestLogger.info("Listing hotel bookings", {
      context: this.context,
      userType: user.userType,
      query,
    });

    if (query.startDate && query.endDate) {
      if (new Date(query.startDate) > new Date(query.endDate)) {
        requestLogger.warn("startDate is later than endDate", {
          context: this.context,
          startDate: query.startDate,
          endDate: query.endDate,
        });
        throw new BadRequestException("startDate cannot be later than endDate");
      }
    }

    let airlineScopeId: number | undefined;

    if (user.userType === UserType.AIRLINE) {
      airlineScopeId = user.airlineId;

      if (!airlineScopeId) {
        requestLogger.error(
          "Authenticated airline user does not have an associated airlineId",
          { context: this.context, userId: user.sub },
        );
        throw new ForbiddenException(
          "You do not have permission to access hotel bookings for this airline",
        );
      }

      if (query.airlineId && query.airlineId !== airlineScopeId) {
        requestLogger.warn(
          "Airline user attempted to filter by another airlineId",
          {
            context: this.context,
            requestedAirlineId: query.airlineId,
            ownAirlineId: airlineScopeId,
          },
        );
        throw new BadRequestException(
          "airlineId filter is not allowed for other airlines",
        );
      }
    } else {
      airlineScopeId = query.airlineId;
    }

    const { hotelBookings, totalCount } =
      await this.repository.findHotelBookingsWithPaginationAndFilters(
        {
          page,
          limit,
          destinationAirportId: query.destinationAirportId,
          cancelledFlightId: query.cancelledFlightId,
          search: query.search,
          airlineId: airlineScopeId,
          startDate: query.startDate,
          endDate: query.endDate,
        },
        requestLogger,
      );

    requestLogger.info("Hotel bookings fetched successfully", {
      context: this.context,
      totalCount,
      page,
      limit,
    });

    return {
      hotelBookings: hotelBookings.map((hotelBooking) => ({
        id: hotelBooking.id,
        cancelledFlightId: hotelBooking.cancelledFlightId,
        flightNumber: hotelBooking.cancelledFlight.flightNumber,
        flightStatus: hotelBooking.cancelledFlight.status,
        airlineId: hotelBooking.cancelledFlight.airlineId,
        airline: {
          id: hotelBooking.cancelledFlight.airline.id,
          name: hotelBooking.cancelledFlight.airline.name,
          code: hotelBooking.cancelledFlight.airline.code,
        },
        destinationAirport: {
          id: hotelBooking.cancelledFlight.arrivalAirport.id,
          code: hotelBooking.cancelledFlight.arrivalAirport.iataCode,
          name: hotelBooking.cancelledFlight.arrivalAirport.name,
        },
        passenger: {
          id: hotelBooking.booking.id,
          pnr: hotelBooking.booking.pnr,
          firstName: hotelBooking.booking.firstName,
          lastName: hotelBooking.booking.lastName,
          email: hotelBooking.booking.email,
          travelClass: hotelBooking.booking.travelClass,
          phone: hotelBooking.booking.phone,
          adults: hotelBooking.booking.adults,
          children: hotelBooking.booking.children,
        },
        hotelName: hotelBooking.hotelName,
        rate: hotelBooking.category,
        checkInDate: hotelBooking.checkInDate,
        checkOutDate: hotelBooking.checkOutDate,
        totalRooms: hotelBooking.totalRooms,
        totalPrice: Number(hotelBooking.totalPrice),
        status: hotelBooking.status,
        createdAt: hotelBooking.createdAt.toISOString(),
        updatedAt: hotelBooking.updatedAt?.toISOString() ?? null,
      })),
      pagination: {
        currentPage: page,
        limit,
        totalCount,
      },
    };
  }

  // ── Detail ───────────────────────────────────────────────────────────────

  async getHotelBookingDetail(
    hotelBookingId: number,
    user: AuthenticatedUser,
    requestLogger: Logger,
  ): Promise<HotelBookingDetailResponseDto> {
    requestLogger.info("Fetching hotel booking detail", {
      context: this.context,
      hotelBookingId,
    });

    const hotelBooking = await this.requireHotelBooking(
      hotelBookingId,
      user,
      requestLogger,
    );

    return this.toDetailDto(hotelBooking, user);
  }

  // ── Export ───────────────────────────────────────────────────────────────

  async exportHotelBooking(
    hotelBookingId: number,
    user: AuthenticatedUser,
    requestLogger: Logger,
  ): Promise<{ fileName: string; csv: string }> {
    requestLogger.info("Exporting hotel booking", {
      context: this.context,
      hotelBookingId,
    });

    const hotelBooking = await this.requireHotelBooking(
      hotelBookingId,
      user,
      requestLogger,
    );

    const detail = this.toDetailDto(hotelBooking, user);
    const csv = this.buildCsv(detail);

    requestLogger.info("Hotel booking exported successfully", {
      context: this.context,
      hotelBookingId,
    });

    return {
      fileName: `hotel-booking-${hotelBookingId}.csv`,
      csv,
    };
  }

  // ── Send email ───────────────────────────────────────────────────────────

  async sendHotelBookingEmail(
    hotelBookingId: number,
    user: AuthenticatedUser,
    requestId: string,
    requestLogger: Logger,
  ): Promise<SendHotelBookingEmailResponseDto> {
    requestLogger.info("Sending hotel booking email", {
      context: this.context,
      hotelBookingId,
    });

    const hotelBooking = await this.requireHotelBooking(
      hotelBookingId,
      user,
      requestLogger,
    );

    const flightStatus = hotelBooking.cancelledFlight.status;
    if (
      flightStatus !== FlightStatus.PAID &&
      flightStatus !== FlightStatus.PUBLISHED
    ) {
      requestLogger.warn(
        "Rejected hotel booking email send due to flight status",
        {
          context: this.context,
          hotelBookingId,
          flightStatus,
        },
      );
      throw new BadRequestException(
        `Cannot send hotel booking email while the flight status is '${flightStatus}'. Flight must be 'paid' or 'published'.`,
      );
    }

    const recipientEmail = hotelBooking.booking.email;

    try {
      await this.sesClient.send(
        new SendEmailCommand({
          Source: config.ses.fromEmail,
          Destination: {
            ToAddresses: [recipientEmail],
          },
          Message: {
            Subject: {
              Data: `Your hotel booking confirmation for flight ${hotelBooking.cancelledFlight.flightNumber}`,
            },
            Body: {
              Text: {
                Data: this.buildEmailBody(hotelBooking),
              },
            },
          },
        }),
      );
    } catch (error: any) {
      requestLogger.error("Failed to send hotel booking email", {
        context: this.context,
        hotelBookingId,
        recipientEmail,
        requestId,
        error: error?.message,
      });
      throw new BadRequestException(
        `Failed to send hotel booking email: ${error?.message ?? "unknown error"}`,
      );
    }

    requestLogger.info("Hotel booking email sent successfully", {
      context: this.context,
      hotelBookingId,
      recipientEmail,
    });

    return {
      hotelBookingId,
      sentTo: recipientEmail,
      message: "Hotel booking confirmation email sent",
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async requireHotelBooking(
    hotelBookingId: number,
    user: AuthenticatedUser,
    requestLogger: Logger,
  ): Promise<HotelAllocationEntity> {
    const hotelBooking = await this.repository.findHotelBookingById(
      hotelBookingId,
      requestLogger,
    );

    if (!hotelBooking) {
      requestLogger.warn("Hotel booking not found", {
        context: this.context,
        hotelBookingId,
      });
      throw new NotFoundException(
        `Hotel booking '${hotelBookingId}' not found`,
      );
    }

    if (
      user.userType === UserType.AIRLINE &&
      hotelBooking.cancelledFlight.airlineId !== user.airlineId
    ) {
      requestLogger.warn(
        "Airline user attempted to access another airline's hotel booking",
        {
          context: this.context,
          hotelBookingId,
          ownerAirlineId: hotelBooking.cancelledFlight.airlineId,
          requestingAirlineId: user.airlineId,
        },
      );
      // 404, not 403 — don't reveal that the record exists to another airline.
      throw new NotFoundException(
        `Hotel booking '${hotelBookingId}' not found`,
      );
    }

    return hotelBooking;
  }

  private toDetailDto(
    hotelBooking: HotelAllocationEntity,
    user: AuthenticatedUser,
  ): HotelBookingDetailResponseDto {
    const flight = hotelBooking.cancelledFlight;
    const includeMarginFields = user.userType !== UserType.AIRLINE;

    const hotel: HotelBookingHotelDetailDto = {
      hotelCode: hotelBooking.hotelCode,
      hotelName: hotelBooking.hotelName,
      category: hotelBooking.category,
      checkInDate: hotelBooking.checkInDate,
      checkOutDate: hotelBooking.checkOutDate,
      rooms: hotelBooking.rooms ?? [],
      totalRooms: hotelBooking.totalRooms,
      actualPrice: Number(hotelBooking.actualPrice),
      ...(includeMarginFields && {
        buyingPrice: Number(hotelBooking.buyingPrice),
      }),
      sellingPrice: Number(hotelBooking.sellingPrice),
      tax: Number(hotelBooking.tax),
      platformFee: Number(hotelBooking.platformFee),
      discount: Number(hotelBooking.discount),
      totalPrice: Number(hotelBooking.totalPrice),
      ...(includeMarginFields && {
        earnings: Number(hotelBooking.earnings),
      }),
      status: hotelBooking.status,
      bookingReference: hotelBooking.bookingReference,
      createdAt: hotelBooking.createdAt.toISOString(),
      updatedAt: hotelBooking.updatedAt?.toISOString() ?? null,
    };

    return {
      id: hotelBooking.id,
      flight: {
        id: flight.id,
        flightNumber: flight.flightNumber,
        airlineId: flight.airlineId,
        departureAirportId: flight.departureAirportId,
        arrivalAirportId: flight.arrivalAirportId,
        cancellationDate: flight.cancellationDate,
        cancellationReason: flight.cancellationReason ?? null,
        status: flight.status,
        createdAt: flight.createdAt.toISOString(),
        updatedAt: flight.updatedAt?.toISOString() ?? null,
        route: {
          departureAirport: {
            id: flight.departureAirport.id,
            code: flight.departureAirport.iataCode,
            name: flight.departureAirport.name,
          },
          arrivalAirport: {
            id: flight.arrivalAirport.id,
            code: flight.arrivalAirport.iataCode,
            name: flight.arrivalAirport.name,
          },
        },
      },
      booking: {
        id: hotelBooking.booking.id,
        cancelledFlightId: hotelBooking.booking.cancelledFlightId,
        pnr: hotelBooking.booking.pnr,
        firstName: hotelBooking.booking.firstName,
        lastName: hotelBooking.booking.lastName,
        email: hotelBooking.booking.email,
        phone: hotelBooking.booking.phone,
        travelClass: hotelBooking.booking.travelClass,
        adults: hotelBooking.booking.adults,
        children: hotelBooking.booking.children,
        specialNotes: hotelBooking.booking.specialNotes ?? [],
        additionalNotes: hotelBooking.booking.additionalNotes ?? null,
        createdAt: hotelBooking.booking.createdAt.toISOString(),
        updatedAt: hotelBooking.booking.updatedAt?.toISOString() ?? null,
      },
      hotel,
    };
  }

  private csvEscape(value: string | number | null | undefined): string {
    const str = value === null || value === undefined ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  }

  private buildCsv(detail: HotelBookingDetailResponseDto): string {
    const roomsSummary = detail.hotel.rooms
      .map(
        (room) =>
          `${room.adults}A/${room.children}C ${room.roomName} (${room.boardName})`,
      )
      .join("; ");

    const headers = [
      "Hotel Booking ID",
      "Booking Reference",
      "Flight Number",
      "Flight Status",
      "Cancellation Date",
      "Departure Airport",
      "Arrival Airport",
      "Passenger Name",
      "PNR",
      "Passenger Email",
      "Passenger Phone",
      "Travel Class",
      "Hotel Name",
      "Category",
      "Check-in Date",
      "Check-out Date",
      "Rooms",
      "Total Rooms",
      "Total Price",
      "Status",
    ];

    const row = [
      detail.id,
      detail.hotel.bookingReference,
      detail.flight.flightNumber,
      detail.flight.status,
      detail.flight.cancellationDate,
      detail.flight.route.departureAirport.code,
      detail.flight.route.arrivalAirport.code,
      `${detail.booking.firstName} ${detail.booking.lastName}`,
      detail.booking.pnr,
      detail.booking.email,
      detail.booking.phone,
      detail.booking.travelClass,
      detail.hotel.hotelName,
      detail.hotel.category,
      detail.hotel.checkInDate,
      detail.hotel.checkOutDate,
      roomsSummary,
      detail.hotel.totalRooms,
      detail.hotel.totalPrice,
      detail.hotel.status,
    ];

    return [
      headers.map((header) => this.csvEscape(header)).join(","),
      row.map((value) => this.csvEscape(value)).join(","),
    ].join("\n");
  }

  private buildEmailBody(hotelBooking: HotelAllocationEntity): string {
    const roomsSummary = (hotelBooking.rooms ?? [])
      .map(
        (room) =>
          `${room.adults} adult(s)/${room.children} child(ren) - ${room.roomName} (${room.boardName})`,
      )
      .join("; ");

    return [
      `Dear ${hotelBooking.booking.firstName} ${hotelBooking.booking.lastName},`,
      "",
      `Your hotel booking for cancelled flight ${hotelBooking.cancelledFlight.flightNumber} is confirmed.`,
      "",
      `Hotel: ${hotelBooking.hotelName} (${hotelBooking.category})`,
      `Check-in: ${hotelBooking.checkInDate}`,
      `Check-out: ${hotelBooking.checkOutDate}`,
      `Rooms: ${roomsSummary || "N/A"}`,
      `Booking Reference: ${hotelBooking.bookingReference}`,
      "",
      "Please contact the hotel directly for any special requests.",
    ].join("\n");
  }
}
