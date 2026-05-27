import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AdminEntity } from "../../admin/entities/admin.entity";
import { AirlineAdminInviteEntity } from "./airline-admin-invite.entity";

export enum AIRLINE_INVITATION_HISTORY_EVENTS {
  SENT = "SENT",
  RESENT = "RESENT",
  REVOKED = "REVOKED",
  ACCEPTED = "ACCEPTED",
}

@Entity("airline_admin_invite_history")
export class AirlineAdminInviteHistoryEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "invitation_id", type: "integer" })
  invitationId!: number;

  @ManyToOne(() => AirlineAdminInviteEntity, (invite) => invite.history, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "invitation_id" })
  invitation!: AirlineAdminInviteEntity;

  @Column({
    name: "event",
    type: "enum",
    enum: AIRLINE_INVITATION_HISTORY_EVENTS,
  })
  event!: AIRLINE_INVITATION_HISTORY_EVENTS;

  @Column({ name: "performed_by_admin_id", type: "integer", nullable: true })
  performedByAdminId!: number | null;

  @ManyToOne(() => AdminEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "performed_by_admin_id" })
  performedByAdmin!: AdminEntity | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
