import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AirlineUserEntity } from "../../airline/entities/airline-user.entity";

@Entity("airline_password_reset_otps")
export class AirlinePasswordResetOtpEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_user_id", type: "integer" })
  airlineUserId!: number;

  @ManyToOne(() => AirlineUserEntity, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "airline_user_id" })
  airlineUser!: AirlineUserEntity;

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
