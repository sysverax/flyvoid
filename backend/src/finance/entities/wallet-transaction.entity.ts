import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { WalletEntity } from "./wallet.entity";
import {
  TRANSACTION_TYPES,
  TRANSACTION_REFERENCE_TYPES,
} from "../constants/transaction.enum";

@Entity("wallet_transactions")
export class WalletTransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "wallet_id" })
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "wallet_id" })
  wallet!: WalletEntity;

  @Column({ type: "simple-enum", enum: TRANSACTION_TYPES })
  type!: TRANSACTION_TYPES;

  @Column({
    name: "reference_type",
    type: "simple-enum",
    enum: TRANSACTION_REFERENCE_TYPES,
  })
  referenceType!: TRANSACTION_REFERENCE_TYPES;

  @Column({ name: "reference_id" })
  referenceId!: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ name: "balance_before", type: "decimal", precision: 12, scale: 2 })
  balanceBefore!: number;

  @Column({ name: "balance_after", type: "decimal", precision: 12, scale: 2 })
  balanceAfter!: number;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "created_by", type: "integer", nullable: true })
  createdBy?: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
