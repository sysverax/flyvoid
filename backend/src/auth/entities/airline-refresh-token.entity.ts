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

@Entity("airline_refresh_tokens")
export class AirlineRefreshTokenEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_user_id", type: "integer" })
  airlineUserId!: number;

  @ManyToOne(() => AirlineUserEntity, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "airline_user_id" })
  airlineUser!: AirlineUserEntity;

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
