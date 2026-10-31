import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CancelledFlightEntity } from "./cancelled-flight.entity";
import { HotelAllocationStatus, TravelClass } from "./enums";

@Entity("cancelled_flight_bookings")
export class BookingEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "pnr", type: "varchar", length: 20 })
  pnr!: string;

  @Column({ name: "first_name", type: "varchar", length: 100 })
  firstName!: string;

  @Column({ name: "last_name", type: "varchar", length: 100 })
  lastName!: string;

  @Column({ name: "email", type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "phone", type: "varchar", length: 30 })
  phone!: string;

  /** Passport country, ISO 3166-1 alpha-2 (e.g. "US"); suppliers price by it. */
  @Column({ name: "residency", type: "varchar", length: 2 })
  residency!: string;

  @Column({ name: "travel_class", type: "varchar", length: 20 })
  travelClass!: TravelClass;

  @Column({ name: "adults", type: "integer", default: 1 })
  adults!: number;

  @Column({ name: "children", type: "integer", default: 0 })
  children!: number;

  /** One age per child (0-12), so its length equals `children`. */
  @Column({ name: "child_ages", type: "jsonb", default: () => "'[]'" })
  childAges!: number[];

  /**
   * Special Notes as entered: preset labels and free text, comma-separated.
   * Hotel allocation reads the presets it lists with deriveSpecialNotes()
   * (booking-notes.ts).
   */
  @Column({ name: "special_notes", type: "text", nullable: true })
  specialNotes?: string | null;

  @ManyToOne(() => CancelledFlightEntity, (flight) => flight.bookings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  // ── Hotel allocation state for this PNR ──
  @Column({
    name: "allocation_status",
    type: "varchar",
    length: 50,
    default: HotelAllocationStatus.DRAFT,
  })
  allocationStatus!: HotelAllocationStatus;

  @Column({ name: "allocation_reason", type: "text", nullable: true })
  allocationReason?: string | null;

  /** The hotel_bookings row that is this PNR's confirmed hotel. */
  @Column({
    name: "confirmed_hotel_booking_id",
    type: "integer",
    nullable: true,
  })
  confirmedHotelBookingId?: number | null;

  @Column({ name: "processing_order", type: "integer", nullable: true })
  processingOrder?: number | null;

  @Column({ name: "class_priority", type: "integer", nullable: true })
  classPriority?: number | null;

  @Column({ name: "plan_id", type: "varchar", length: 64, nullable: true })
  planId?: string | null;

  @Column({ name: "planned_at", type: "timestamp", nullable: true })
  plannedAt?: Date | null;

  @Column({ name: "room_plan", type: "jsonb", nullable: true })
  roomPlan?: Array<{
    adults: number;
    children: number;
    roomsNeeded: number;
  }> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
