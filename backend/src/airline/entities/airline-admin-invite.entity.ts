import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AdminEntity } from "../../admin/entities/admin.entity";
import { AirlineEntity } from "./airline.entity";
import { AirlineAdminInviteHistoryEntity } from "./airline-admin-invite-history.entity";
import { MetaAirlineInviteEntity } from "./meta-airline-invite.entity";
import { AIRLINE_INVITATION_STATUSES } from "../utils/airline-invitation-status.enum";

@Entity("airline_admin_invites")
export class AirlineAdminInviteEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_id", type: "integer", nullable: true })
  airlineId!: number | null;

  @OneToOne(() => AirlineEntity, (airline) => airline.invitation, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "airline_id" })
  airline!: AirlineEntity | null;

  @Column({ name: "meta_id", type: "integer", unique: true })
  metaId!: number;

  @OneToOne(() => MetaAirlineInviteEntity, (meta) => meta.invitation, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "meta_id" })
  meta!: MetaAirlineInviteEntity;

  @Column({ name: "invited_by_admin_id", type: "integer" })
  invitedByAdminId!: number;

  @ManyToOne(() => AdminEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "invited_by_admin_id" })
  invitedByAdmin!: AdminEntity | null;

  @Column({ name: "token_lookup", type: "varchar", length: 64, unique: true })
  tokenLookup!: string;

  @Column({ name: "token_hash", type: "text" })
  tokenHash!: string;

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @Column({
    name: "status",
    type: "enum",
    enum: AIRLINE_INVITATION_STATUSES,
    default: AIRLINE_INVITATION_STATUSES.PENDING,
  })
  status!: AIRLINE_INVITATION_STATUSES;

  @Column({ name: "accepted_at", type: "timestamp", nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: "revoked_at", type: "timestamp", nullable: true })
  revokedAt!: Date | null;

  @OneToMany(() => AirlineAdminInviteHistoryEntity, (h) => h.invitation)
  history!: AirlineAdminInviteHistoryEntity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
