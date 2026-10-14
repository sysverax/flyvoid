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
import { ProviderEntity } from "./provider.entity";
import type { HotelPolicies } from "../hotel-providers/hotel-provider.interface";

export interface HotelContact {
  phones: Array<{ phoneNumber: string; phoneType: string }>;
  email: string | null;
}

/** Static hotel data, one row per provider hotel. */
@Entity("hotels")
@Index("uq_hotels_provider_hotel", ["providerId", "providerHotelId"], {
  unique: true,
})
export class HotelEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ name: "provider_id", type: "integer" })
  providerId!: number;

  /** The provider's own hotel ID (RateHawk hid, Hotelbeds code). */
  @Column({ name: "provider_hotel_id", type: "varchar", length: 255 })
  providerHotelId!: string;

  @Column({ name: "name", type: "varchar", length: 255, default: "" })
  name!: string;

  @Column({ name: "star_rating", type: "integer", nullable: true })
  starRating?: number | null;

  /** Property type from the supplier, e.g. hotel, apartment, hostel. */
  @Column({ name: "kind", type: "varchar", length: 50, nullable: true })
  kind?: string | null;

  @Column({ name: "address", type: "text", nullable: true })
  address?: string | null;

  @Column({ name: "postal_code", type: "varchar", length: 20, nullable: true })
  postalCode?: string | null;

  @Column({ name: "country_code", type: "varchar", length: 2, nullable: true })
  countryCode?: string | null;

  @Column({
    name: "latitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude?: number | null;

  @Column({
    name: "longitude",
    type: "numeric",
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude?: number | null;

  @Column({ name: "contact", type: "jsonb", nullable: true })
  contact?: HotelContact | null;

  @Column({ name: "website", type: "text", nullable: true })
  website?: string | null;

  @Column({ name: "image_url", type: "text", nullable: true })
  imageUrl?: string | null;

  @Column({ name: "amenities", type: "jsonb", nullable: true })
  amenities?: string[] | null;

  @Column({ name: "policies", type: "jsonb", nullable: true })
  policies?: HotelPolicies | null;

  /** False when the supplier reports the hotel closed or removed; never offered then. */
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "content_updated_at", type: "timestamp", nullable: true })
  contentUpdatedAt?: Date | null;

  @ManyToOne(() => ProviderEntity)
  @JoinColumn({ name: "provider_id" })
  provider?: ProviderEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
