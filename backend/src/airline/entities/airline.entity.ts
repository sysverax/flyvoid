import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AirlineUserEntity } from "./airline-user.entity";

@Entity("airlines")
export class AirlineEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "name", type: "varchar", length: 150 })
  name!: string;

  @Column({ name: "code", type: "varchar", length: 20, unique: true })
  code!: string;

  @Column({ name: "country_code", type: "varchar", length: 2 })
  countryCode!: string;

  @Column({ name: "company_registration_number", type: "varchar", length: 100 })
  companyRegistrationNumber!: string;

  @Column({ name: "website", type: "varchar", length: 255, nullable: true })
  website?: string | null;

  @Column({ name: "contact_email", type: "varchar", length: 255 })
  contactEmail!: string;

  @Column({ name: "contact_phone", type: "varchar", length: 30 })
  contactPhone!: string;

  @Column({ name: "timezone", type: "varchar", length: 100 })
  timezone!: string;

  @Column({ name: "logo", type: "varchar", length: 512, nullable: true })
  logo?: string | null;

  @Column({ name: "address", type: "varchar", length: 255 })
  address!: string;

  @Column({ name: "currency", type: "varchar", length: 10 })
  currency!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => AirlineUserEntity, (user) => user.airline)
  users!: AirlineUserEntity[];
}
