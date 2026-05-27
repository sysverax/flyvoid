import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AirlineAdminInviteEntity } from "./airline-admin-invite.entity";

@Entity("meta_airline_invites")
export class MetaAirlineInviteEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @OneToOne(() => AirlineAdminInviteEntity, (invitation) => invitation.meta)
  invitation!: AirlineAdminInviteEntity;

  @Column({ name: "airline_name", type: "varchar", length: 150 })
  airlineName!: string;

  @Column({ name: "airline_code", type: "varchar", length: 20 })
  airlineCode!: string;

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

  @Column({ name: "currency", type: "varchar", length: 10 })
  currency!: string;

  @Column({ name: "address", type: "varchar", length: 255 })
  address!: string;

  @Column({ name: "logo", type: "varchar", length: 512, nullable: true })
  logo?: string | null;

  @Column({ name: "admin_first_name", type: "varchar", length: 100 })
  adminFirstName!: string;

  @Column({ name: "admin_last_name", type: "varchar", length: 100 })
  adminLastName!: string;

  @Column({ name: "admin_email", type: "varchar", length: 255 })
  adminEmail!: string;

  @Column({ name: "admin_job_title", type: "varchar", length: 100 })
  adminJobTitle!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
