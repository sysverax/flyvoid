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

  @Column()
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "walletId" })
  wallet!: WalletEntity;

  @Column({ type: "simple-enum", enum: TRANSACTION_TYPES })
  type!: TRANSACTION_TYPES;

  @Column({ type: "simple-enum", enum: TRANSACTION_REFERENCE_TYPES })
  referenceType!: TRANSACTION_REFERENCE_TYPES;

  @Column()
  referenceId!: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  balanceBefore!: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  balanceAfter!: number;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "integer", nullable: true })
  createdBy?: number;

  @CreateDateColumn()
  createdAt!: Date;
}
