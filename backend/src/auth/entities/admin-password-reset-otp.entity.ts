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

@Entity("admin_password_reset_otps")
export class AdminPasswordResetOtpEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "admin_id", type: "integer" })
  adminId!: number;

  @ManyToOne(() => AdminEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "admin_id" })
  admin!: AdminEntity;

  @Column({ name: "otp_hash", type: "text" })
  otpHash!: string;

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @Column({ name: "attempt_count", type: "integer", default: 0 })
  attemptCount!: number;

  @Column({ name: "is_verified", type: "boolean", default: false })
  isVerified!: boolean;

  @Column({ name: "is_used", type: "boolean", default: false })
  isUsed!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
