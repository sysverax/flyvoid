import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("health_logs")
export class HealthLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({
    name: "checked_at",
  })
  checkedAt!: Date;

  @Column({
    name: "status",
    type: "varchar",
    length: 50,
  })
  status!: string;

  @Column({
    name: "uptime_seconds",
    type: "integer",
  })
  uptimeSeconds!: number;

  @CreateDateColumn({
    name: "created_at",
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: "updated_at",
  })
  updatedAt!: Date;
}
