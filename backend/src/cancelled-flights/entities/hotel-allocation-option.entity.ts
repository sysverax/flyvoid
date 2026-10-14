import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BookingEntity } from "./booking.entity";
import { CancelledFlightEntity } from "./cancelled-flight.entity";
import { HotelEntity } from "./hotel.entity";

export interface CandidateRateOption {
  rateKey: string;
  adults: number;
  children: number;
  netPrice: number;
  allotment: number;
  inPool: boolean;
}

export interface CandidateRoomPlan {
  adults: number;
  children: number;
  roomsNeeded: number;
  rateOptions: CandidateRateOption[];
}

/** One hotel option planned for a PNR, tried in candidate_order until one books. */
@Entity("hotel_allocation_options")
@Index(
  "uq_hotel_allocation_options_plan_order",
  ["planId", "bookingId", "candidateOrder"],
  { unique: true },
)
export class HotelAllocationOptionEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "booking_id", type: "integer" })
  bookingId!: number;

  @Column({ name: "plan_id", type: "varchar", length: 64 })
  planId!: string;

  @Column({ name: "candidate_order", type: "integer" })
  candidateOrder!: number;

  @Column({ name: "hotel_id", type: "integer" })
  hotelId!: number;

  @Column({ name: "tier", type: "varchar", length: 20 })
  tier!: "pool" | "overflow";

  @Column({ name: "estimated_price", type: "decimal", precision: 10, scale: 2 })
  estimatedPrice!: number;

  @Column({ name: "currency", type: "varchar", length: 10, nullable: true })
  currency?: string | null;

  @Column({ name: "rooms", type: "jsonb" })
  rooms!: CandidateRoomPlan[];

  /** Distance from the flight's departure airport, when the supplier gives it. */
  @Column({ name: "distance_from_airport_km", type: "numeric", nullable: true })
  distanceFromAirportKm?: number | null;

  @ManyToOne(() => CancelledFlightEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  @ManyToOne(() => BookingEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: BookingEntity;

  @ManyToOne(() => HotelEntity)
  @JoinColumn({ name: "hotel_id" })
  hotel?: HotelEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
