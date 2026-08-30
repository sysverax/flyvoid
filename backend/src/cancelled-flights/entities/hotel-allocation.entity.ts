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
import { BookingEntity } from "./booking.entity";

// Stub entity — allocation logic not yet implemented
@Entity("hotel_allocations")
export class HotelAllocationEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "booking_id", type: "integer" })
  bookingId!: number;

  @Column({ name: "hotel_name", type: "varchar", length: 255 })
  hotelName!: string;

  @Column({ name: "hotel_address", type: "text", nullable: true })
  hotelAddress?: string | null;

  @Column({ name: "check_in_date", type: "date" })
  checkInDate!: string;

  @Column({ name: "check_out_date", type: "date" })
  checkOutDate!: string;

  @Column({
    name: "price",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  price!: number;

  @Column({
    name: "buying_price",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  buyingPrice!: number;

  @Column({
    name: "selling_price",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  sellingPrice!: number;

  @Column({
    name: "platform_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  platformFee!: number;

  @Column({
    name: "earnings",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  earnings!: number;

  @ManyToOne(() => CancelledFlightEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  // one booking has one or mor hotel allocation based on the number of passengers and their travel class
  @ManyToOne(() => BookingEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: BookingEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // Add hotel details as well
}
