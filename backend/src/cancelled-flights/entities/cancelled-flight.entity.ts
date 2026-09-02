import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AirlineEntity } from "../../airline/entities/airline.entity";
import { AirportEntity } from "../../airline/entities/airport.entity";
import { BookingEntity } from "./booking.entity";
import { CancellationReason, FlightStatus } from "./enums";

@Entity("cancelled_flights")
export class CancelledFlightEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "flight_number", type: "varchar", length: 20 })
  flightNumber!: string;

  @Column({ name: "airline_id", type: "integer" })
  airlineId!: number;

  @Column({ name: "departure_airport_id", type: "integer" })
  departureAirportId!: number;

  @Column({ name: "arrival_airport_id", type: "integer" })
  arrivalAirportId!: number;

  @Column({ name: "cancellation_date", type: "date" })
  cancellationDate!: string;

  @Column({
    name: "cancellation_reason",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  cancellationReason?: CancellationReason | null;

  @Column({ name: "cancellation_reason_text", type: "text", nullable: true })
  cancellationReasonText?: string | null;

  @Column({
    name: "status",
    type: "varchar",
    length: 20,
    default: FlightStatus.DRAFT,
  })
  status!: FlightStatus;

  // After passengers' booking is confirmed booking details are immutable, so we store the total bookings, total adults, and total children at the time of confirmation
  @Column({ name: "total_booking", type: "integer", nullable: true })
  totalBooking?: number | null;

  @Column({ name: "total_adults", type: "integer", nullable: true })
  totalAdults?: number | null;

  @Column({ name: "total_children", type: "integer", nullable: true })
  totalChildren?: number | null;

  // After published data is immutable, so we store the total cost of hotel allocations at the time of publishing
  @Column({ name: "total_hotel_rooms", type: "integer", nullable: true })
  totalHotelRooms?: number | null;

  @Column({
    name: "total_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalPrice?: number | null;

  @Column({
    name: "total_buying_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalBuyingPrice?: number | null;

  @Column({
    name: "total_selling_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalSellingPrice?: number | null;

  @Column({
    name: "total_platform_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalPlatformFee?: number | null;

  @Column({
    name: "total_earnings",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalEarnings?: number | null;

  @ManyToOne(() => AirlineEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "airline_id" })
  airline!: AirlineEntity;

  @ManyToOne(() => AirportEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "departure_airport_id" })
  departureAirport!: AirportEntity;

  @ManyToOne(() => AirportEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "arrival_airport_id" })
  arrivalAirport!: AirportEntity;

  @OneToMany(() => BookingEntity, (booking) => booking.cancelledFlight)
  bookings!: BookingEntity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
