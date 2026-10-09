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

@Entity("hotel_booking_candidates")
@Index(
  "uq_hotel_booking_candidates_plan_order",
  ["planId", "bookingId", "candidateOrder"],
  { unique: true },
)
export class HotelBookingCandidateEntity {
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

  @Column({ name: "hotel_code", type: "varchar", length: 255 })
  hotelCode!: string;

  @Column({ name: "hotel_name", type: "varchar", length: 255 })
  hotelName!: string;

  @Column({ name: "category", type: "varchar", length: 255 })
  category!: string;

  @Column({ name: "stars", type: "integer" })
  stars!: number;

  @Column({ name: "tier", type: "varchar", length: 20 })
  tier!: "pool" | "overflow";

  @Column({ name: "estimated_price", type: "decimal", precision: 10, scale: 2 })
  estimatedPrice!: number;

  @Column({ name: "currency", type: "varchar", length: 10, nullable: true })
  currency?: string | null;

  @Column({ name: "rooms", type: "jsonb" })
  rooms!: CandidateRoomPlan[];

  @ManyToOne(() => CancelledFlightEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  @ManyToOne(() => BookingEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: BookingEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
