import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('recommendation_jobs')
@Index('idx_recommendation_jobs_expires_at', ['expiresAt'])
@Index('idx_recommendation_jobs_flight_id', ['flightId'])
@Index('idx_recommendation_jobs_status', ['status'])
export class RecommendationJobEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  flightId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'PENDING',
  })
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'jsonb', nullable: true })
  result: {
    success: boolean;
    requestId: string;
    timestamp: string;
    data: {
      cancelledFlightId: number;
      flightNumber: string;
      flightStatus: string;
      checkInDate: string;
      checkOutDate: string;
      departureAirport: string;
      supplyBufferRatio: number;
      totalPnrs: number;
      allocatedPnrs: number;
      unallocatedPnrs: number;
      allAllocated: boolean;
      supplyPool: Array<{
        shape: { adults: number; children: number };
        roomsNeeded: number;
        target: number;
        poolAllotment: number;
        targetMet: boolean;
        totalAllotment: number;
        hotels: string[];
        rates: number;
      }>;
      splits: Array<{
        rooms: Array<{ adults: number; children: number }>;
        roomSplitOptions: {
          preferred: Array<{ adults: number; children: number }>;
          fallbacks: Array<{ adults: number; children: number }>;
        };
        bookedAsOneOrder: boolean;
        totalPnrs: number;
        pnrs: Array<{
          order: number;
          bookingId: number;
          pnr: string;
          travelClass: string;
          minStars: number;
          adults: number;
          children: number;
          recommended: {
            rank: number;
            hotelCode: string;
            hotelName: string;
            stars: number;
            price: number;
            currency: string;
            rooms: Array<{
              adults: number;
              children: number;
              roomsNeeded: number;
              roomName: string;
              boardName: string;
              paymentType: string;
              freeCancellationBefore: string;
              netPrice: number;
              rateKey: string;
            }>;
          };
        }>;
      }>;
    };
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp without time zone', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp without time zone' })
  expiresAt: Date;
}
