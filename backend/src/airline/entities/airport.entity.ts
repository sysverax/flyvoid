import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AdminEntity } from "../../admin/entities/admin.entity";
import { AirportType } from "../utils";

@Entity("airports")
export class AirportEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "name", type: "varchar", length: 150 })
  name!: string;

  @Column({ name: "iata_code", type: "varchar", length: 3, unique: true })
  iataCode!: string;

  @Column({ name: "icao_code", type: "varchar", length: 4, unique: true })
  icaoCode!: string;

  @Column({ name: "country_code", type: "varchar", length: 2 })
  countryCode!: string;

  @Column({ name: "city", type: "varchar", length: 100 })
  city!: string;

  @Column({ name: "latitude", type: "numeric", precision: 10, scale: 7 })
  latitude!: number;

  @Column({ name: "longitude", type: "numeric", precision: 10, scale: 7 })
  longitude!: number;

  @Column({ name: "timezone", type: "varchar", length: 100 })
  timezone!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({
    name: "type",
    type: "simple-enum",
    enum: AirportType,
  })
  type!: AirportType;

  @Column({ name: "address", type: "varchar", length: 255, nullable: true })
  address?: string | null;

  @Column({
    name: "postal_code",
    type: "varchar",
    length: 20,
  })
  postalCode!: string;

  @Column({ name: "created_by", type: "integer" })
  createdBy!: number;

  @Column({ name: "updated_by", type: "integer", nullable: true })
  updatedBy?: number | null;

  @ManyToOne(() => AdminEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by" })
  createdByAdmin!: AdminEntity;

  @ManyToOne(() => AdminEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "updated_by" })
  updatedByAdmin?: AdminEntity | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
