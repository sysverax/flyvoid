import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { CalendarDateField } from "../../common/dto/date-range-query.dto";

/** One room of a room split: who sleeps in it. */
export class PlanPreviewRoomDto {
  @ApiProperty({ example: 2, minimum: 1, maximum: 6 })
  @Max(6, { message: "A room can have at most 6 adults" })
  @Min(1, { message: "Each room needs at least 1 adult" })
  @IsInt({ message: "rooms[].adults must be an integer" })
  adults!: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: 4 })
  @Max(4, { message: "A room can have at most 4 children" })
  @Min(0, { message: "rooms[].children cannot be negative" })
  @IsInt({ message: "rooms[].children must be an integer" })
  children!: number;
}

/**
 * Test / preview input shared by both plan-preview APIs: stay, airport and
 * one PNR's party and room split, with no flight or booking.
 * checkInDate/checkOutDate are calendar dates at the hotel (DATE semantics,
 * no timezone conversion).
 */
export class PlanPreviewSearchDto {
  @ApiProperty({ example: 2, minimum: 1, maximum: 9 })
  @Max(9, { message: "adults can be at most 9" })
  @Min(1, { message: "adults must be at least 1" })
  @IsInt({ message: "adults must be an integer" })
  adults!: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: 9 })
  @Max(9, { message: "children can be at most 9" })
  @Min(0, { message: "children cannot be negative" })
  @IsInt({ message: "children must be an integer" })
  children!: number;

  @CalendarDateField({
    required: true,
    description: "Check-in date at the hotel (YYYY-MM-DD)",
  })
  checkInDate!: string;

  @CalendarDateField({
    required: true,
    description: "Check-out date at the hotel (YYYY-MM-DD); after checkInDate",
  })
  checkOutDate!: string;

  @ApiProperty({
    description: "IATA code of the airport to search hotels around",
    example: "DXB",
  })
  @Length(3, 3, { message: "departureAirport must be a 3-letter IATA code" })
  @IsString({ message: "departureAirport must be a string" })
  departureAirport!: string;

  @ApiPropertyOptional({
    type: [PlanPreviewRoomDto],
    description:
      "Room split of ONE PNR, e.g. [{adults:4,children:1},{adults:3,children:0}] for 7 adults + 1 child in 2 rooms. Must hold exactly adults and children. Omit to use the split allocation would choose.",
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PlanPreviewRoomDto)
  @ArrayMaxSize(9, { message: "rooms can have at most 9 rooms" })
  @ArrayMinSize(1, { message: "rooms must have at least 1 room" })
  @IsArray({ message: "rooms must be an array" })
  rooms?: PlanPreviewRoomDto[];

  @ApiPropertyOptional({
    description:
      "Guests' passport country (ISO 3166-1 alpha-2); suppliers price by it. Defaults to the airport's country.",
    example: "AE",
  })
  @IsOptional()
  @IsISO31661Alpha2({ message: "residency must be a 2-letter country code" })
  residency?: string;
}

/** Hotels preview: one plain geo search around the airport, no filters. */
export class PlanPreviewHotelsRequestDto extends PlanPreviewSearchDto {
  @ApiPropertyOptional({
    description: "Search radius around the airport, in HOTEL_SEARCH_RADIUS_UNIT (km by default). One search at this radius, no widening. Defaults to HOTEL_SEARCH_RADIUS.",
    example: 10,
    minimum: 1,
    maximum: 70,
  })
  @IsOptional()
  @Max(70, { message: "radius can be at most 70" })
  @Min(1, { message: "radius must be at least 1" })
  @IsInt({ message: "radius must be an integer" })
  radius?: number;
}

export enum SplitPreviewNeed {
  ALL = "all",
  RECOMMEND = "recommend",
}

/** One room split and how many PNRs (allocations) need it. */
export class SplitPreviewSplitDto {
  @ApiProperty({
    type: [PlanPreviewRoomDto],
    description:
      "The rooms of ONE allocation, e.g. [{adults:2,children:1},{adults:1,children:2}]. All of an allocation's rooms are booked in one hotel.",
  })
  @ValidateNested({ each: true })
  @Type(() => PlanPreviewRoomDto)
  @ArrayMaxSize(9, { message: "rooms can have at most 9 rooms" })
  @ArrayMinSize(1, { message: "rooms must have at least 1 room" })
  @IsArray({ message: "rooms must be an array" })
  rooms!: PlanPreviewRoomDto[];

  @ApiProperty({
    description: "How many allocations (PNRs) need this split.",
    example: 3,
    minimum: 1,
    maximum: 100,
  })
  @Max(100, { message: "allocation can be at most 100" })
  @Min(1, { message: "allocation must be at least 1" })
  @IsInt({ message: "allocation must be an integer" })
  allocation!: number;
}

/**
 * Split preview job: one geo search per room split at `distance`, run in the
 * background; the result is read back by its request id.
 */
export class SplitPreviewRequestDto {
  @CalendarDateField({
    required: true,
    description: "Check-in date at the hotel (YYYY-MM-DD)",
  })
  checkInDate!: string;

  @CalendarDateField({
    required: true,
    description: "Check-out date at the hotel (YYYY-MM-DD); after checkInDate",
  })
  checkOutDate!: string;

  @ApiProperty({
    description: "IATA code of the airport to search hotels around",
    example: "DXB",
  })
  @Length(3, 3, { message: "departureAirport must be a 3-letter IATA code" })
  @IsString({ message: "departureAirport must be a string" })
  departureAirport!: string;

  @ApiPropertyOptional({
    description:
      "Guests' passport country (ISO 3166-1 alpha-2); suppliers price by it. Defaults to the airport's country.",
    example: "AE",
  })
  @IsOptional()
  @IsISO31661Alpha2({ message: "residency must be a 2-letter country code" })
  residency?: string;

  @ApiProperty({
    description:
      "Search radius around the airport, in HOTEL_SEARCH_RADIUS_UNIT (km by default). One search per split at exactly this radius, no widening.",
    example: 20,
    minimum: 1,
    maximum: 70,
  })
  @Max(70, { message: "distance can be at most 70" })
  @Min(1, { message: "distance must be at least 1" })
  @IsInt({ message: "distance must be an integer" })
  distance!: number;

  @ApiProperty({
    enum: SplitPreviewNeed,
    description:
      "all: every hotel the search finds for each split. recommend: only the best hotels for 150% of each split's allocation.",
    example: SplitPreviewNeed.RECOMMEND,
  })
  @IsEnum(SplitPreviewNeed, { message: "need must be 'all' or 'recommend'" })
  need!: SplitPreviewNeed;

  @ApiProperty({ type: [SplitPreviewSplitDto] })
  @ValidateNested({ each: true })
  @Type(() => SplitPreviewSplitDto)
  @ArrayMaxSize(10, { message: "splits can have at most 10 room splits" })
  @ArrayMinSize(1, { message: "splits must have at least 1 room split" })
  @IsArray({ message: "splits must be an array" })
  splits!: SplitPreviewSplitDto[];
}
