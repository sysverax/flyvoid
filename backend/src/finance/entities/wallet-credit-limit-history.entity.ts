import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { WalletEntity } from "./wallet.entity";

@Entity("wallet_credit_limit_history")
export class WalletCreditLimitHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "walletId" })
  wallet!: WalletEntity;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  previousCreditLimit!: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  newCreditLimit!: number;

  @Column()
  reason!: string;

  @Column()
  changedByAdminId!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
