import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BookingEntity } from "./booking.entity";
import { CancelledFlightEntity } from "./cancelled-flight.entity";
import { HotelAllocationOptionEntity } from "./hotel-allocation-option.entity";
import { HotelBookingAttemptStatus, HotelBookingPaymentStatus } from "./enums";
import { HotelEntity } from "./hotel.entity";
import { ProviderEntity } from "./provider.entity";
import { HotelBookingRoomEntity } from "./hotel-booking-room.entity";

/**
 * One booking attempt for a PNR at one hotel. Failed attempts are kept; at most
 * one non-failed attempt exists per PNR, and its PNR points at it once confirmed.
 */
@Entity("hotel_bookings")
@Index("uq_hotel_bookings_booking_order", ["bookingId", "attemptOrder"], {
  unique: true,
})
@Index("uq_hotel_bookings_one_active", ["bookingId"], {
  unique: true,
  where: "status <> 'failed'",
})
export class HotelBookingEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "booking_id", type: "integer" })
  bookingId!: number;

  @Column({ name: "provider_id", type: "integer" })
  providerId!: number;

  @Column({ name: "hotel_id", type: "integer", nullable: true })
  hotelId?: number | null;

  @Column({ name: "candidate_id", type: "integer", nullable: true })
  candidateId?: number | null;

  @Column({ name: "run_id", type: "varchar", length: 64, nullable: true })
  runId?: string | null;

  @Column({ name: "attempt_order", type: "integer" })
  attemptOrder!: number;

  @Column({ name: "status", type: "varchar", length: 20 })
  status!: HotelBookingAttemptStatus;

  @Column({ name: "check_in_date", type: "date", nullable: true })
  checkInDate?: string | null;

  @Column({ name: "check_out_date", type: "date", nullable: true })
  checkOutDate?: string | null;

  @Column({ name: "currency", type: "varchar", length: 10, nullable: true })
  currency?: string | null;

  @Column({
    name: "actual_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  actualPrice!: number;

  @Column({
    name: "buying_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  buyingPrice!: number;

  @Column({
    name: "platform_fee_percentage",
    type: "decimal",
    precision: 5,
    scale: 2,
    default: 0,
  })
  platformFeePercentage!: number;

  @Column({
    name: "platform_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  platformFee!: number;

  @Column({
    name: "total_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalPrice!: number;

  @Column({
    name: "earnings",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  earnings!: number;

  @Column({
    name: "provider_status",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  providerStatus?: string | null;

  @Column({ name: "provider_request_id", type: "varchar", length: 64 })
  providerRequestId!: string;

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

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt?: Date | null;

  @Column({ name: "failed_at", type: "timestamp", nullable: true })
  failedAt?: Date | null;

  @Column({
    name: "payment_status",
    type: "varchar",
    length: 20,
    default: HotelBookingPaymentStatus.PENDING,
  })
  paymentStatus!: HotelBookingPaymentStatus;

  @Column({ name: "paid_at", type: "timestamp", nullable: true })
  paidAt?: Date | null;

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

  @ManyToOne(() => ProviderEntity)
  @JoinColumn({ name: "provider_id" })
  provider?: ProviderEntity;

  @ManyToOne(() => HotelEntity, { nullable: true })
  @JoinColumn({ name: "hotel_id" })
  hotel?: HotelEntity | null;

  /** The allocation option this attempt booked (null for single-PNR bookings). */
  @ManyToOne(() => HotelAllocationOptionEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "candidate_id" })
  candidate?: HotelAllocationOptionEntity | null;

  @OneToMany(() => HotelBookingRoomEntity, (room) => room.hotelBooking)
  rooms?: HotelBookingRoomEntity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
