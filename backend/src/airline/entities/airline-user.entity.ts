import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AirlineRole } from "../../common/constants/user.constants";
import { AirlineEntity } from "./airline.entity";

@Entity("airline_users")
export class AirlineUserEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_id", type: "integer" })
  airlineId!: number;

  @ManyToOne(() => AirlineEntity, (airline) => airline.users, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "airline_id" })
  airline!: AirlineEntity;

  @Column({ name: "first_name", type: "varchar", length: 100 })
  firstName!: string;

  @Column({ name: "last_name", type: "varchar", length: 100 })
  lastName!: string;

  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ name: "job_title", type: "varchar", length: 100 })
  jobTitle!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({
    name: "role",
    type: "simple-enum",
    enum: AirlineRole,
    default: AirlineRole.AIRLINE_STAFF,
  })
  role!: AirlineRole;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "last_login_at", nullable: true })
  lastLoginAt?: Date;

  @Column({ name: "two_factor_enabled", type: "boolean", default: false })
  twoFactorEnabled!: boolean;

  @Column({ name: "two_factor_secret_encrypted", type: "text", nullable: true })
  twoFactorSecretEncrypted?: string | null;

  @Column({
    name: "two_factor_temp_secret_encrypted",
    type: "text",
    nullable: true,
  })
  twoFactorTempSecretEncrypted?: string | null;

  @Column({
    name: "two_factor_recovery_code_hashes",
    type: "simple-json",
    nullable: true,
  })
  twoFactorRecoveryCodeHashes?: string[] | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
