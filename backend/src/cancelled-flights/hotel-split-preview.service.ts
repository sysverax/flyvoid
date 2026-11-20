import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Logger } from "winston";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { UserType } from "../common/constants/user.constants";
import { SplitPreviewRequestDto } from "./dto/plan-preview-request.dto";
import {
  HotelSplitPreviewEntity,
  HotelSplitPreviewStatus,
} from "./entities/hotel-split-preview.entity";
import { HotelAllocationService } from "./hotel-allocation.service";

/**
 * Split preview jobs (test API): POST starts one in the background and
 * returns its id; GET reads it back. Results are kept for 5 days.
 */
@Injectable()
export class HotelSplitPreviewService {
  private readonly context = HotelSplitPreviewService.name;
  private static readonly KEEP_FOR = "5 days";
  /** A job still RUNNING after this was cut off (e.g. by a restart). */
  private static readonly STALE_AFTER = "30 minutes";

  constructor(
    @InjectRepository(HotelSplitPreviewEntity)
    private readonly previews: Repository<HotelSplitPreviewEntity>,
    private readonly hotelAllocationService: HotelAllocationService,
  ) {}

  async start(
    input: SplitPreviewRequestDto,
    user: AuthenticatedRequest["user"],
    requestId: string,
    requestLogger: Logger,
  ) {
    // Bad airport or dates fail here with 400, before anything is stored.
    const stay = await this.hotelAllocationService.resolvePreviewStay(input);
    // Our own id, not the caller's x-request-id (which may repeat).
    const previewId = randomUUID();

    await this.previews
      .createQueryBuilder()
      .delete()
      .where("expires_at <= now()")
      .execute();
    await this.previews
      .createQueryBuilder()
      .insert()
      .values({
        id: previewId,
        status: HotelSplitPreviewStatus.RUNNING,
        request: input,
        airlineId: user.airlineId ?? null,
        userId: user.sub ?? null,
        expiresAt: () => `now() + interval '${HotelSplitPreviewService.KEEP_FOR}'`,
      })
      .execute();
    requestLogger.info("Hotel split preview started in the background", {
      context: this.context,
      previewId,
      need: input.need,
      splits: input.splits.length,
    });

    void this.hotelAllocationService
      .computeSplitPreview(input, stay, requestId, requestLogger)
      .then((result) =>
        this.previews.update(
          { id: previewId },
          { status: HotelSplitPreviewStatus.COMPLETED, result },
        ),
      )
      .catch((error: any) => {
        requestLogger.error("Hotel split preview failed", {
          context: this.context,
          previewId,
          error: error?.message,
          stack: error?.stack,
        });
        return this.previews.update(
          { id: previewId },
          {
            status: HotelSplitPreviewStatus.FAILED,
            error: String(error?.message ?? error),
          },
        );
      })
      .catch((error: any) =>
        requestLogger.error("Could not save the hotel split preview result", {
          context: this.context,
          previewId,
          error: error?.message,
        }),
      );

    return {
      requestId: previewId,
      status: HotelSplitPreviewStatus.RUNNING,
      need: input.need,
      splits: input.splits.length,
    };
  }

  async get(id: string, user: AuthenticatedRequest["user"]) {
    const row = await this.previews
      .createQueryBuilder("p")
      .select("p")
      .addSelect(
        `p.status = :running AND p.created_at < now() - interval '${HotelSplitPreviewService.STALE_AFTER}'`,
        "stale",
      )
      .where("p.id = :id", { id })
      .andWhere("p.expires_at > now()")
      .setParameter("running", HotelSplitPreviewStatus.RUNNING)
      .getRawAndEntities();
    const preview = row.entities[0];
    // Airline users only read their own airline's previews; platform users any.
    const allowed =
      user.userType === UserType.PLATFORM ||
      (!!preview && !!user.airlineId && preview.airlineId === user.airlineId);
    if (!preview || !allowed) {
      throw new NotFoundException(`Split preview '${id}' not found or expired`);
    }
    const stale = row.raw[0]?.stale === true;
    return {
      requestId: preview.id,
      status: stale ? HotelSplitPreviewStatus.FAILED : preview.status,
      error: stale
        ? "The preview stopped before it finished (the server may have restarted); start it again"
        : (preview.error ?? null),
      request: preview.request,
      result: preview.result ?? null,
      createdAt: preview.createdAt,
      expiresAt: preview.expiresAt,
    };
  }
}
