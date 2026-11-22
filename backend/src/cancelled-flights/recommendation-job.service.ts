import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RecommendationJobEntity } from './entities/recommendation-job.entity';

@Injectable()
export class RecommendationJobService {
  constructor(
    @InjectRepository(RecommendationJobEntity)
    private jobRepository: Repository<RecommendationJobEntity>,
  ) {}

  /**
   * Create a new recommendation job
   * @param flightId The cancelled flight ID
   * @returns The job ID
   */
  async createJob(flightId: number): Promise<string> {
    const jobId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire after 7 days

    await this.jobRepository.save({
      id: jobId,
      flightId,
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt,
    });

    return jobId;
  }

  /**
   * Retrieve a job by ID
   * @param jobId The job ID
   * @returns The job entity or throws NotFoundException
   */
  async getJob(jobId: string): Promise<RecommendationJobEntity> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    if (job.expiresAt < new Date()) {
      throw new NotFoundException(`Job ${jobId} has expired`);
    }

    return job;
  }

  /**
   * Update job status to PROCESSING
   * @param jobId The job ID
   */
  async updateProcessing(jobId: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'PROCESSING',
      updatedAt: new Date(),
    });
  }

  /**
   * Update job with successful result
   * @param jobId The job ID
   * @param result The recommendation result
   */
  async updateCompleted(
    jobId: string,
    result: RecommendationJobEntity['result'],
  ): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'COMPLETED',
      result,
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Update job with error
   * @param jobId The job ID
   * @param error The error message
   */
  async updateFailed(jobId: string, error: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'FAILED',
      errorMessage: error,
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Clean up expired jobs (older than 7 days)
   * Called periodically by a scheduled task
   */
  async cleanupExpiredJobs(): Promise<number> {
    const result = await this.jobRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }
}
