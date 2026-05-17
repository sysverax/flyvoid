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

@Entity("refresh_tokens")
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "admin_id", type: "integer" })
  adminId!: number;

  @ManyToOne(() => AdminEntity, (admin) => admin.refreshTokens, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "admin_id" })
  admin!: AdminEntity;

  @Column({ name: "token_hash", type: "text" })
  tokenHash!: string;

  @Column({ name: "expires_at" })
  expiresAt!: Date;

  @Column({ name: "is_revoked", type: "boolean", default: false })
  isRevoked!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
