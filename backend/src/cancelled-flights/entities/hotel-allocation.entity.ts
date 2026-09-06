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
import { HotelAllocationStatus } from "./enums";

// Stub entity — allocation logic not yet implemented
@Entity("hotel_allocations")
export class HotelAllocationEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "booking_id", type: "integer" })
  bookingId!: number;

  @Column({ name: "check_in_date", type: "date" })
  checkInDate!: string;

  @Column({ name: "check_out_date", type: "date" })
  checkOutDate!: string;

  @Column({
    name: "actual_price",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  actualPrice!: number;

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
    name: "tax",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  tax!: number;

  @Column({
    name: "platform_fee",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  platformFee!: number;

  @Column({
    name: "total_price",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  totalPrice!: number;

  @Column({
    name: "earnings",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  earnings!: number;

  @Column({
    name: "discount",
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  discount!: number;

  @Column({ name: "hotel_code", type: "varchar", length: 255 })
  hotelCode!: string;

  @Column({ name: "hotel_name", type: "varchar", length: 255 })
  hotelName!: string;

  @Column({ name: "category", type: "varchar", length: 255 })
  category!: string;

  // adults, children, roomName, boardName, price
  @Column({ name: "rooms", type: "jsonb", nullable: true })
  rooms!: {
    adults: number;
    children: number;
    roomName: string;
    boardName: string;
    price: number;
  }[];

  @Column({ name: "total_rooms", type: "integer", nullable: true })
  totalRooms!: number;

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

  @Column({
    name: "status",
    type: "enum",
    enum: HotelAllocationStatus,
    default: HotelAllocationStatus.DRAFT,
  })
  status!: HotelAllocationStatus;

  @Column({ name: "booking_reference", type: "varchar", length: 255 })
  bookingReference!: string;
}
