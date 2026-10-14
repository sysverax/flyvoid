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
import { HotelBookingEntity } from "./hotel-booking.entity";
import type { TaxAtProperty } from "../hotel-providers/hotel-provider.interface";

export type HotelBookingRoomStatus = "pending" | "booked" | "failed";

/** One room of a hotel booking; with RateHawk each room is its own supplier order. */
@Entity("hotel_booking_rooms")
@Index("uq_hotel_booking_rooms_room", ["hotelBookingId", "roomNo"], {
  unique: true,
})
export class HotelBookingRoomEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "hotel_booking_id", type: "integer" })
  hotelBookingId!: number;

  @Column({ name: "room_no", type: "integer" })
  roomNo!: number;

  @Column({ name: "room_name", type: "text", default: "" })
  roomName!: string;

  @Column({ name: "board_name", type: "varchar", length: 255, default: "" })
  boardName!: string;

  @Column({ name: "adults", type: "integer", default: 0 })
  adults!: number;

  @Column({ name: "children", type: "integer", default: 0 })
  children!: number;

  @Column({ name: "price", type: "decimal", precision: 10, scale: 2, default: 0 })
  price!: number;

  @Column({
    name: "buying_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  buyingPrice!: number;

  @Column({ name: "rate_key", type: "text", nullable: true })
  rateKey?: string | null;

  @Column({ name: "taxes_at_property", type: "jsonb", nullable: true })
  taxesAtProperty?: TaxAtProperty[] | null;

  /** Our order reference sent to the supplier (RateHawk partner_order_id). */
  @Column({
    name: "partner_order_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  partnerOrderId?: string | null;

  /** The supplier's own order number (RateHawk order_id). */
  @Column({
    name: "provider_order_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  providerOrderId?: string | null;

  @Column({ name: "status", type: "varchar", length: 20, default: "booked" })
  status!: HotelBookingRoomStatus;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason?: string | null;

  @ManyToOne(() => HotelBookingEntity, (booking) => booking.rooms, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "hotel_booking_id" })
  hotelBooking?: HotelBookingEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
