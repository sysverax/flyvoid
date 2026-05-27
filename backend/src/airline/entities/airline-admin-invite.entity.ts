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
import { AirlineEntity } from "./airline.entity";

@Entity("airline_admin_invites")
export class AirlineAdminInviteEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_id", type: "integer" })
  airlineId!: number;

  @ManyToOne(() => AirlineEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "airline_id" })
  airline!: AirlineEntity;

  @Column({ name: "invited_by_admin_id", type: "integer" })
  invitedByAdminId!: number;

  @ManyToOne(() => AdminEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invited_by_admin_id" })
  invitedByAdmin!: AdminEntity;

  @Column({ name: "first_name", type: "varchar", length: 100 })
  firstName!: string;

  @Column({ name: "last_name", type: "varchar", length: 100 })
  lastName!: string;

  @Column({ name: "email", type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "job_title", type: "varchar", length: 100 })
  jobTitle!: string;

  @Column({ name: "token_lookup", type: "varchar", length: 64, unique: true })
  tokenLookup!: string;

  @Column({ name: "token_hash", type: "text" })
  tokenHash!: string;

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @Column({ name: "is_accepted", type: "boolean", default: false })
  isAccepted!: boolean;

  @Column({ name: "is_revoked", type: "boolean", default: false })
  isRevoked!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
