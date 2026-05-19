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
  PlatformAsset,
} from "../../common/constants/access-control.constants";
import { AdminEntity } from "./admin.entity";

@Index("idx_platform_access_controls_admin_id", ["adminId"])
@Index(
  "uq_platform_access_controls_admin_asset_action",
  ["adminId", "asset", "accessAction"],
  {
    unique: true,
  },
)
@Entity("platform_access_controls")
export class PlatformAccessControlEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "admin_id", type: "integer" })
  adminId!: number;

  @ManyToOne(() => AdminEntity, (admin) => admin.platformAccessControls, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "admin_id" })
  admin!: AdminEntity;

  @Column({
    name: "asset",
    type: "simple-enum",
    enum: PlatformAsset,
  })
  asset!: PlatformAsset;

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
