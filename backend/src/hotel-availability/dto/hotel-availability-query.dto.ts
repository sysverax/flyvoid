import { plainToInstance, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { CalendarDateField } from "../../common/dto/date-range-query.dto";

/** RateHawk serp/geo takes at most 70 km. */
export const HOTEL_AVAILABILITY_MAX_RADIUS_KM = 70;
/** RateHawk multiroom orders take 2–9 rooms. */
export const HOTEL_AVAILABILITY_MAX_ROOMS = 9;
export const HOTEL_AVAILABILITY_MAX_NIGHTS = 30;

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
};

export class HotelAvailabilityRoomDto {
  @ApiProperty({ example: 2, minimum: 1, maximum: 6 })
  @Max(6, { message: "A room can have at most 6 adults" })
  @Min(1, { message: "Each room needs at least 1 adult" })
  @IsInt({ message: "rooms[].adults must be an integer" })
  adults!: number;

  @ApiProperty({
    type: [Number],
    example: [7],
    description: "One age (0–17) per child; empty when there are no children",
  })
  @Max(17, { each: true, message: "Child ages must be between 0 and 17" })
  @Min(0, { each: true, message: "Child ages must be between 0 and 17" })
  @IsInt({ each: true, message: "Child ages must be whole numbers" })
  @ArrayMaxSize(4, { message: "A room can have at most 4 children" })
  @IsArray({ message: "rooms[].childrenAges must be an array" })
  childrenAges!: number[];
}

// Rooms arrive as a JSON string in the query; anything unparseable is left
// as is so the validators report it.
const parseRooms = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((room) =>
          room && typeof room === "object"
            ? plainToInstance(HotelAvailabilityRoomDto, room)
            : room,
        )
      : parsed;
  } catch {
    return value;
  }
};

// class-validator runs a property's decorators bottom-up: type checks sit
// closest to the property so they report first (stopAtFirstError).
//
// checkInDate/checkOutDate are calendar dates at the hotel (DATE semantics,
// no timezone conversion); check-out is the departure day. Rules that need
// the airport (today in its timezone) are checked in the service.
export class HotelAvailabilityQueryDto {
  @ApiProperty({ description: "Hotel provider id (GET /hotel-providers)", example: 1 })
  @Transform(toOptionalNumber)
  @Min(1, { message: "providerId must be greater than or equal to 1" })
  @IsInt({ message: "providerId must be an integer" })
  providerId!: number;

  @ApiProperty({ description: "Airport to search around", example: 4 })
  @Transform(toOptionalNumber)
  @Min(1, { message: "airportId must be greater than or equal to 1" })
  @IsInt({ message: "airportId must be an integer" })
  airportId!: number;

  @CalendarDateField({
    required: true,
    description: "Check-in date at the hotel (YYYY-MM-DD)",
  })
  checkInDate!: string;

  @CalendarDateField({
    required: true,
    description: `Check-out date at the hotel (YYYY-MM-DD); after checkInDate, at most ${HOTEL_AVAILABILITY_MAX_NIGHTS} nights`,
  })
  checkOutDate!: string;

  @ApiProperty({
    type: String,
    description: `JSON array of rooms (1–${HOTEL_AVAILABILITY_MAX_ROOMS}), each { adults: 1–6, childrenAges: [0–17, max 4] }`,
    example: '[{"adults":2,"childrenAges":[]}]',
  })
  @Transform(parseRooms)
  @ValidateNested({ each: true })
  @ArrayMaxSize(HOTEL_AVAILABILITY_MAX_ROOMS, {
    message: `rooms can have at most ${HOTEL_AVAILABILITY_MAX_ROOMS} rooms`,
  })
  @ArrayMinSize(1, { message: "rooms must have at least 1 room" })
  @IsArray({ message: "rooms must be a JSON array of rooms" })
  rooms!: HotelAvailabilityRoomDto[];

  @ApiPropertyOptional({
    description: `Search radius in km (1–${HOTEL_AVAILABILITY_MAX_RADIUS_KM}); defaults to HOTEL_SEARCH_RADIUS`,
    example: 10,
  })
  @IsOptional()
  @Transform(toOptionalNumber)
  @Max(HOTEL_AVAILABILITY_MAX_RADIUS_KM, {
    message: `radius can be at most ${HOTEL_AVAILABILITY_MAX_RADIUS_KM} km`,
  })
  @Min(1, { message: "radius must be at least 1 km" })
  @IsInt({ message: "radius must be a whole number of km" })
  radius?: number;

  @ApiPropertyOptional({
    description:
      "Guest country (ISO 3166-1 alpha-2); suppliers price by it. Defaults to the airport's country",
    example: "AE",
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2({
    message: "residency must be an ISO 3166-1 alpha-2 country code, e.g. AE",
  })
  residency?: string;
}
