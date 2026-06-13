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

// Stub entity — allocation logic not yet implemented
@Entity("hotel_allocations")
export class HotelAllocationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "cancelled_flight_id", type: "uuid" })
  cancelledFlightId!: string;

  @Column({ name: "hotel_name", type: "varchar", length: 255 })
  hotelName!: string;

  @Column({ name: "hotel_address", type: "text", nullable: true })
  hotelAddress?: string | null;

  @Column({ name: "check_in_date", type: "date" })
  checkInDate!: string;

  @Column({ name: "check_out_date", type: "date" })
  checkOutDate!: string;

  @Column({
    name: "total_rooms",
    type: "integer",
    nullable: true,
  })
  totalRooms?: number | null;

  @Column({
    name: "cost_per_room",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  costPerRoom?: number | null;

  @ManyToOne(() => CancelledFlightEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
