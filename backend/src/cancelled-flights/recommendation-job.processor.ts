import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecommendationJobService } from './recommendation-job.service';
import { HotelAllocationService } from './hotel-allocation.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-request.interface';
import { Logger } from 'winston';
import * as winston from 'winston';

/**
 * Background job processor for hotel allocation recommendations
 * Handles async processing of recommendation jobs
 */
@Injectable()
export class RecommendationJobProcessor {
  private readonly logger: Logger;

  constructor(
    private recommendationJobService: RecommendationJobService,
    private hotelAllocationService: HotelAllocationService,
  ) {
    // Create a simple Winston logger for background tasks
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  /**
   * Process a single recommendation job
   * Called from controller after job is queued
   * @param jobId The job ID
   * @param flightId The cancelled flight ID
   * @param user The authenticated user (for access control)
   * @param requestId Request ID for logging
   * @param requestLogger Optional request logger (overrides default)
   */
  async processRecommendation(
    jobId: string,
    flightId: number,
    user: AuthenticatedUser,
    requestId: string,
    requestLogger?: Logger,
  ): Promise<void> {
    const logger = requestLogger || this.logger;

    try {
      logger.info(
        `Processing recommendation job ${jobId} for flight ${flightId}`,
      );

      // Update status to PROCESSING
      await this.recommendationJobService.updateProcessing(jobId);

      // Call the existing allocation preview service
      // This returns the data object (not wrapped)
      const result = await this.hotelAllocationService.previewFlightAllocation(
        flightId,
        user,
        requestId,
        logger,
      );

      // Wrap the result in BaseResponseDto format and save to job
      const jobResult = {
        success: true,
        requestId,
        timestamp: new Date().toISOString(),
        data: result,
      } as any;

      await this.recommendationJobService.updateCompleted(jobId, jobResult);

      logger.info(`Recommendation job ${jobId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error processing recommendation';
      logger.error(
        `Recommendation job ${jobId} failed: ${errorMessage}`,
      );
      await this.recommendationJobService.updateFailed(
        jobId,
        errorMessage,
      );
    }
  }

  /**
   * Clean up expired recommendation jobs (older than 7 days)
   * Runs daily at 2:00 AM UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredJobs(): Promise<void> {
    try {
      const deleted = await this.recommendationJobService.cleanupExpiredJobs();
      this.logger.info(
        `Cleaned up ${deleted} expired recommendation jobs`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error cleaning up expired jobs: ${errorMessage}`,
      );
    }
  }
}
