import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { AirportEntity } from "./airport.entity";
import { AirlineEntity } from "./airline.entity";

@Entity("airline_airports")
@Unique("uq_airline_airports_airline_airport", ["airlineId", "airportId"])
export class AirlineAirportEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_id", type: "integer" })
  airlineId!: number;

  @ManyToOne(() => AirlineEntity, (airline) => airline.airports, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "airline_id" })
  airline!: AirlineEntity;

  @Column({ name: "airport_id", type: "integer" })
  airportId!: number;

  @ManyToOne(() => AirportEntity, (airport) => airport.airlines, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "airport_id" })
  airport!: AirportEntity;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "assigned_by_admin_id", type: "integer" })
  assignedByAdminId!: number;

  @Column({ name: "assigned_at", type: "timestamp" })
  assignedAt!: Date;

  @Column({ name: "disabled_by_admin_id", type: "integer", nullable: true })
  disabledByAdminId!: number | null;

  @Column({ name: "disabled_at", type: "timestamp", nullable: true })
  disabledAt!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
