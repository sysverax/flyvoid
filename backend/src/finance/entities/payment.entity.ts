import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { WalletEntity } from "./wallet.entity";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../constants";

@Entity("payments")
export class PaymentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "wallet_id" })
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "wallet_id" })
  wallet!: WalletEntity;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 10 })
  currency!: string;

  @Column({ type: "simple-enum", enum: PAYMENT_METHODS })
  method!: PAYMENT_METHODS;

  @Column({ type: "simple-enum", enum: PAYMENT_STATUSES })
  status!: PAYMENT_STATUSES;

  @Column({ name: "reference_code", nullable: true })
  referenceCode?: string;

  @Column({ name: "transaction_id", nullable: true })
  transactionId?: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
