import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { WalletHoldEntity } from "./wallet-hold.entity";
import { WALLET_HOLD_ITEM_STATUSES } from "../constants/wallet-hold.enum";

/** One PNR's share of a wallet hold: its estimated hotel cost plus platform fee. */
@Entity("wallet_hold_items")
@Unique("uq_wallet_hold_items_hold_booking", ["holdId", "bookingId"])
@Index("uq_wallet_hold_items_held_booking", ["bookingId"], {
  unique: true,
  where: "status = 'HELD'",
})
export class WalletHoldItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "hold_id" })
  holdId!: number;

  @ManyToOne(() => WalletHoldEntity, (hold) => hold.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "hold_id" })
  hold!: WalletHoldEntity;

  @Column({ name: "booking_id" })
  bookingId!: number;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount!: number;

  @Column({
    type: "varchar",
    length: 20,
    default: WALLET_HOLD_ITEM_STATUSES.HELD,
  })
  status!: WALLET_HOLD_ITEM_STATUSES;

  @Column({ name: "hotel_booking_id", type: "integer", nullable: true })
  hotelBookingId?: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
