import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { WalletEntity } from "./wallet.entity";
import { WalletHoldItemEntity } from "./wallet-hold-item.entity";
import { WALLET_HOLD_STATUSES } from "../constants/wallet-hold.enum";

/**
 * Funds locked in a wallet by one hotel allocation run of a cancelled flight.
 * remainingAmount is always the sum of its items still HELD.
 */
@Entity("wallet_holds")
export class WalletHoldEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "wallet_id" })
  walletId!: number;

  @ManyToOne(() => WalletEntity)
  @JoinColumn({ name: "wallet_id" })
  wallet!: WalletEntity;

  @Column({ name: "cancelled_flight_id" })
  cancelledFlightId!: number;

  @Column({ name: "run_id", type: "varchar", length: 64, unique: true })
  runId!: string;

  @Column({
    name: "initial_amount",
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
  })
  initialAmount!: number;

  @Column({
    name: "remaining_amount",
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
  })
  remainingAmount!: number;

  @Column({
    type: "varchar",
    length: 20,
    default: WALLET_HOLD_STATUSES.OPEN,
  })
  status!: WALLET_HOLD_STATUSES;

  @OneToMany(() => WalletHoldItemEntity, (item) => item.hold)
  items?: WalletHoldItemEntity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
