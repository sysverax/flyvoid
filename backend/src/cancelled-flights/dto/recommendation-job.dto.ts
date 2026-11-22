import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response from starting an async recommendation job
 */
export class StartRecommendationJobResponseDto {
  @ApiProperty({
    description: 'The unique job ID for tracking',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['PENDING'],
    example: 'PENDING',
  })
  status: 'PENDING';

  @ApiProperty({
    description: 'Message with polling URL',
    example:
      'Job f47ac10b-58cc-4372-a567-0e02b2c3d479 started. Poll /plan-preview/recommendation/f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  message: string;
}

/**
 * Response when polling a recommendation job result
 */
export class GetRecommendationJobResponseDto {
  @ApiProperty({
    description: 'The job ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @ApiPropertyOptional({
    description: 'When the job completed (ISO 8601)',
    example: '2026-11-22T10:53:01.192Z',
  })
  completedAt?: string;

  @ApiPropertyOptional({
    description:
      'The recommendation result (same structure as synchronous API)',
  })
  result?: {
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
      supplyPool: Array<any>;
      splits: Array<any>;
    };
  };

  @ApiPropertyOptional({
    description: 'Error message if status is FAILED',
    example: 'Flight not found',
  })
  errorMessage?: string;
}
