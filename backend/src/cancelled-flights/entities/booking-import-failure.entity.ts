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
import type {
  BookingFieldError,
  FailedBookingValues,
} from "../booking-import";

/** A CSV row that failed validation, kept until it is fixed or deleted. */
@Entity("cancelled_flight_booking_import_failures")
export class BookingImportFailureEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "cancelled_flight_id", type: "integer" })
  cancelledFlightId!: number;

  @Column({ name: "file_name", type: "varchar", length: 255, nullable: true })
  fileName?: string | null;

  /** The row's line in the file (header = row 1). */
  @Column({ name: "row_number", type: "integer" })
  rowNumber!: number;

  @Column({ name: "values", type: "jsonb" })
  values!: FailedBookingValues;

  @Column({ name: "errors", type: "jsonb" })
  errors!: BookingFieldError[];

  @ManyToOne(() => CancelledFlightEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cancelled_flight_id" })
  cancelledFlight!: CancelledFlightEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
