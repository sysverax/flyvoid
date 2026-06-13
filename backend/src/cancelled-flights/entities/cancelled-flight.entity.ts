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
import { BookingEntity } from "./booking.entity"
import { CancellationReason, FlightStatus } from "./enums";

@Entity("cancelled_flights")
export class CancelledFlightEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

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

  @Column({
    name: "total_hotel_cost",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalHotelCost?: number | null;

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
