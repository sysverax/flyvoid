import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { WalletEntity } from "./wallet.entity";
import { TRANSACTION_TYPES } from "../constants";

@Entity("wallet_adjustments")
export class WalletAdjustmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "wallet_id" })
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "wallet_id" })
  wallet!: WalletEntity;

  @Column({ type: "simple-enum", enum: TRANSACTION_TYPES })
  type!: TRANSACTION_TYPES;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column()
  reason!: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  @Column({ name: "adjusted_by_admin_id" })
  adjustedByAdminId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
