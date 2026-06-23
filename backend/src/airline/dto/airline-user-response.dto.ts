import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../common/constants/user.constants";

export class AirlineUserResponseDto {
  @ApiProperty({ description: "Airline user unique identifier", example: 201 })
  id!: number;

  @ApiProperty({ description: "Airline identifier", example: 12 })
  airlineId!: number;

  @ApiProperty({ description: "Airline user first name", example: "Aisha" })
  firstName!: string;

  @ApiProperty({ description: "Airline user last name", example: "Khan" })
  lastName!: string;

  @ApiProperty({
    description: "Airline user email",
    example: "aisha.khan@skyjet.com",
  })
  email!: string;

  @ApiProperty({ description: "Job title", example: "Operations Executive" })
  jobTitle!: string;

  @ApiProperty({
    description: "Airline user role",
    enum: AirlineRole,
    example: AirlineRole.AIRLINE_STAFF,
  })
  role!: AirlineRole;

  @ApiProperty({ description: "Account active status", example: true })
  isActive!: boolean;

  @ApiProperty({
    description: "Last login timestamp",
    example: "2026-05-16T09:10:11.000Z",
    nullable: true,
  })
  lastLoginAt!: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2026-05-16T08:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2026-05-16T08:30:00.000Z",
  })
  updatedAt!: string;
}
