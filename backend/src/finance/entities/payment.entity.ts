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

  @Column()
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "walletId" })
  wallet!: WalletEntity;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: "varchar", length: 10 })
  currency!: string;

  @Column({ type: "simple-enum", enum: PAYMENT_METHODS })
  method!: PAYMENT_METHODS;

  @Column({ type: "simple-enum", enum: PAYMENT_STATUSES })
  status!: PAYMENT_STATUSES;

  @Column({ nullable: true })
  referenceCode?: string;

  @Column({ nullable: true })
  transactionId?: number;

  @CreateDateColumn()
  createdAt!: Date;
}
