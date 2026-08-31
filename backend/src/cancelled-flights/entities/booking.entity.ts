import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CancelledFlightEntity } from "./cancelled-flight.entity";
import { SpecialNote, TravelClass } from "./enums";
import { HotelAllocationEntity } from "./hotel-allocation.entity";

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

  @Column({ name: "travel_class", type: "varchar", length: 20 })
  travelClass!: TravelClass;

  @Column({ name: "adults", type: "integer", default: 1 })
  adults!: number;

  @Column({ name: "children", type: "integer", default: 0 })
  children!: number;

  @Column({
    name: "special_notes",
    type: "simple-array",
    nullable: true,
  })
  specialNotes!: SpecialNote[];

  @Column({ name: "additional_notes", type: "text", nullable: true })
  additionalNotes?: string | null;

  @ManyToOne(() => CancelledFlightEntity, (flight) => flight.bookings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  @OneToOne(() => HotelAllocationEntity, (allocation) => allocation.booking)
  hotelAllocation?: HotelAllocationEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
