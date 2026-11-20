import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export enum HotelSplitPreviewStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/**
 * A split preview job (test API): the request, then its result once the
 * background searches finish. Read back by id; kept until expires_at.
 */
@Entity("hotel_split_previews")
export class HotelSplitPreviewEntity {
  /** The preview id returned by the POST (requestId in its response). */
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar", length: 20 })
  status!: HotelSplitPreviewStatus;

  /** The POST body. */
  @Column({ type: "jsonb" })
  request!: object;

  @Column({ type: "jsonb", nullable: true })
  result?: object | null;

  @Column({ type: "text", nullable: true })
  error?: string | null;

  /** Who asked: airline users only read their own airline's previews. */
  @Column({ name: "airline_id", type: "integer", nullable: true })
  airlineId?: number | null;

  @Column({ name: "user_id", type: "integer", nullable: true })
  userId?: number | null;

  @Column({ name: "expires_at", type: "timestamp without time zone" })
  expiresAt!: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
