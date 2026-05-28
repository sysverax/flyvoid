import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from "typeorm";
import { AirlineEntity } from "../../airline/entities/airline.entity";

@Entity("wallets")
export class WalletEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // ✅ One-to-One relationship
  @OneToOne(() => AirlineEntity, (airline) => airline.wallet, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "airline_id" }) // FK stored here
  airline!: AirlineEntity;

  @Column({ name: "airline_id", unique: true })
  airlineId!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  balance!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  creditLimit!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  usedCredit!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  lockedAmount!: number;

  @Column({ type: "varchar", length: 10, default: "USD" })
  currency!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
