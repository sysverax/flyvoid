import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("supplier_webhook_tokens")
@Index("uq_supplier_webhook_tokens_provider_token", ["provider", "token"], {
  unique: true,
})
export class SupplierWebhookTokenEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "provider", type: "varchar", length: 50 })
  provider!: string;

  @Column({ name: "token", type: "varchar", length: 255 })
  token!: string;

  @CreateDateColumn({ name: "received_at" })
  receivedAt!: Date;
}
