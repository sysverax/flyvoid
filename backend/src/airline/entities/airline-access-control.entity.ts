import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  AccessAction,
  AirlineAsset,
} from "../../common/constants/access-control.constants";
import { AirlineUserEntity } from "./airline-user.entity";

@Index("idx_airline_access_controls_airline_user_id", ["airlineUserId"])
@Index(
  "uq_airline_access_controls_user_asset_action",
  ["airlineUserId", "asset", "accessAction"],
  { unique: true },
)
@Entity("airline_access_controls")
export class AirlineAccessControlEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "airline_user_id", type: "integer" })
  airlineUserId!: number;

  @ManyToOne(() => AirlineUserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "airline_user_id" })
  airlineUser!: AirlineUserEntity;

  @Column({
    name: "asset",
    type: "simple-enum",
    enum: AirlineAsset,
  })
  asset!: AirlineAsset;

  @Column({
    name: "access_action",
    type: "simple-enum",
    enum: AccessAction,
  })
  accessAction!: AccessAction;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
