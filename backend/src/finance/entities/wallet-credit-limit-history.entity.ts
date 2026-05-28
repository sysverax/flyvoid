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

  @Column({ name: "wallet_id" })
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "wallet_id" })
  wallet!: WalletEntity;

  @Column({
    name: "previous_credit_limit",
    type: "decimal",
    precision: 12,
    scale: 2,
  })
  previousCreditLimit!: number;

  @Column({
    name: "new_credit_limit",
    type: "decimal",
    precision: 12,
    scale: 2,
  })
  newCreditLimit!: number;

  @Column()
  reason!: string;

  @Column({ name: "changed_by_admin_id" })
  changedByAdminId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
