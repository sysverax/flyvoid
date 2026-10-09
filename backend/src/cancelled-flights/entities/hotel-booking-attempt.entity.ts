import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BookingEntity } from "./booking.entity";
import { CancelledFlightEntity } from "./cancelled-flight.entity";
import { HotelBookingCandidateEntity } from "./hotel-booking-candidate.entity";
import { HotelBookingAttemptStatus } from "./enums";

@Entity("hotel_booking_attempts")
@Index(
  "uq_hotel_booking_attempts_booking_order",
  ["bookingId", "attemptOrder"],
  { unique: true },
)
@Index("uq_hotel_booking_attempts_one_active", ["bookingId"], {
  unique: true,
  where: "status <> 'failed'",
})
export class HotelBookingAttemptEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "booking_id", type: "integer" })
  bookingId!: number;

  @Column({ name: "candidate_id", type: "integer", nullable: true })
  candidateId?: number | null;

  @Column({ name: "plan_id", type: "varchar", length: 64, nullable: true })
  planId?: string | null;

  @Column({ name: "run_id", type: "varchar", length: 64, nullable: true })
  runId?: string | null;

  @Column({ name: "attempt_order", type: "integer" })
  attemptOrder!: number;

  @Column({ name: "status", type: "varchar", length: 20 })
  status!: HotelBookingAttemptStatus;

  @Column({ name: "hotel_code", type: "varchar", length: 255, nullable: true })
  hotelCode?: string | null;

  @Column({ name: "hotel_name", type: "varchar", length: 255, nullable: true })
  hotelName?: string | null;

  @Column({ name: "category", type: "varchar", length: 255, nullable: true })
  category?: string | null;

  @Column({ name: "rate_keys", type: "jsonb" })
  rateKeys!: string[];

  @Column({ name: "provider", type: "varchar", length: 50 })
  provider!: string;

  @Column({
    name: "provider_status",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  providerStatus?: string | null;

  @Column({
    name: "provider_booking_reference",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  providerBookingReference?: string | null;

  @Column({ name: "provider_request_id", type: "varchar", length: 64 })
  providerRequestId!: string;

  @Column({
    name: "provider_idempotency_key",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  providerIdempotencyKey?: string | null;

  @Column({
    name: "provider_request_sent_at",
    type: "timestamp",
    nullable: true,
  })
  providerRequestSentAt?: Date | null;

  @Column({
    name: "provider_response_received_at",
    type: "timestamp",
    nullable: true,
  })
  providerResponseReceivedAt?: Date | null;

  @Column({
    name: "failure_code",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  failureCode?: string | null;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason?: string | null;

  @Column({ name: "provider_order_info", type: "jsonb", nullable: true })
  providerOrderInfo?: unknown[] | null;

  @Column({
    name: "provider_order_info_at",
    type: "timestamp",
    nullable: true,
  })
  providerOrderInfoAt?: Date | null;

  @ManyToOne(() => CancelledFlightEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  @ManyToOne(() => BookingEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: BookingEntity;

  @ManyToOne(() => HotelBookingCandidateEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "candidate_id" })
  candidate?: HotelBookingCandidateEntity | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
