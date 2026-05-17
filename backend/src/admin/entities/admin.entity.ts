import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AdminRole } from "../../common/constants/user.constants";
import { RefreshTokenEntity } from "../../auth/entities/refresh-token.entity";

@Entity("admins")
export class AdminEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "first_name", type: "varchar", length: 100 })
  firstName!: string;

  @Column({ name: "last_name", type: "varchar", length: 100 })
  lastName!: string;

  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({
    name: "role",
    type: "simple-enum",
    enum: AdminRole,
    default: AdminRole.STAFF,
  })
  role!: AdminRole;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({
    name: "require_password_reset",
    type: "boolean",
    default: false,
  })
  requirePasswordReset!: boolean;

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

  @OneToMany(() => RefreshTokenEntity, (refreshToken) => refreshToken.admin)
  refreshTokens!: RefreshTokenEntity[];
}
