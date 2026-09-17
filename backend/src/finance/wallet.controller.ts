import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { Logger } from "winston";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RbacGuard } from "../auth/guards/rbac.guard";
import {
  RequireAccessControl,
  RequireUserTypes,
} from "../auth/decorators/rbac.decorator";
import {
  AccessAction,
  AirlineAsset,
  PlatformAsset,
} from "../common/constants/access-control.constants";
import { UserType } from "../common/constants/user.constants";
import { BaseResponseDto } from "../common/dto/base-response.dto";
import { RequestId } from "../common/decorators/request-id.decorator";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import {
  createBadRequestErrorSchema,
  createNotFoundErrorSchema,
} from "../common/constants/swagger.constants";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { WalletService } from "./wallet.service";
import {
  CreateWalletAdjustmentRequestDto,
  GetWalletTransactionsQueryDto,
  WalletAdjustmentResponseDto,
  WalletBalanceResponseDto,
  WalletSummaryResponseDto,
  WalletTransactionListResponseDto,
} from "./dto";

@ApiTags("Wallets")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
@Controller("wallets")
@ApiExtraModels(
  WalletAdjustmentResponseDto,
  WalletTransactionListResponseDto,
  WalletBalanceResponseDto,
  WalletSummaryResponseDto,
)
export class WalletController {
  private readonly context: string;
  constructor(private readonly service: WalletService) {
    this.context = "WalletController";
  }

  // ── POST /wallets/adjustments ────────────────────────────────────────────
  @Post("adjustments")
  @HttpCode(201)
  @RequireUserTypes(UserType.PLATFORM)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.PAYMENTS,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Adjust an airline's wallet balance",
    description:
      "Platform-only. Increases (CREDIT) or decreases (DEBIT) an airline's wallet balance, recording both an adjustment and a ledger transaction. reason is optional for CREDIT and mandatory for DEBIT. The wallet row is locked for the duration of the update so concurrent adjustments to the same wallet serialize.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(WalletAdjustmentResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/wallets/adjustments",
      "Wallet not found for this airline",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/wallets/adjustments"),
  })
  async createAdjustment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWalletAdjustmentRequestDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<WalletAdjustmentResponseDto>> {
    requestLogger.info("Creating wallet adjustment", {
      context: this.context,
      user: req.user,
      dto,
    });
    const data = await this.service.createAdjustment(
      req.user,
      dto,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Wallet adjustment created successfully",
    );
  }

  // ── GET /wallets/transactions ────────────────────────────────────────────
  @Get("transactions")
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.PAYMENTS,
      access: [AccessAction.VIEW],
    },
    airline: {
      asset: AirlineAsset.WALLET,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "List wallet transactions",
    description:
      "Returns paginated wallet transaction (ledger) history with optional filters: airlineId (platform users only), type (ADJUSTMENT or BOOKING), status, startDate/endDate. Platform users see all airlines by default; airline users only ever see their own.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(WalletTransactionListResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/wallets/transactions"),
  })
  async listTransactions(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetWalletTransactionsQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<WalletTransactionListResponseDto>> {
    requestLogger.info("Listing wallet transactions", {
      context: this.context,
      user: req.user,
      query,
    });
    const data = await this.service.listTransactions(
      req.user,
      query,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Wallet transactions fetched successfully",
    );
  }

  // ── GET /wallets/balance ─────────────────────────────────────────────────
  @Get("balance")
  @RequireUserTypes(UserType.AIRLINE)
  @ApiOperation({
    summary: "Get wallet balance",
    description:
      "Returns wallet balance and credit details. Airline users always see their own wallet; platform users must pass ?airlineId= to pick one.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(WalletBalanceResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/wallets/balance",
      "Wallet not found for this airline",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/wallets/balance"),
  })
  async getWalletBalance(
    @Req() req: AuthenticatedRequest,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<WalletBalanceResponseDto>> {
    const data = await this.service.getWalletBalance(
      req.user,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Wallet balance fetched successfully",
    );
  }

  // ── GET /wallets/summary ─────────────────────────────────────────────────
  @Get("summary")
  @RequireUserTypes(UserType.PLATFORM)
  @RequireAccessControl({
    platform: {
      asset: [PlatformAsset.PAYMENTS, PlatformAsset.AIRLINES],
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get wallets summary",
    description:
      "Platform-only. Returns total wallet balance, total credit issued, and total credit used across all airlines.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(WalletSummaryResponseDto) },
      },
    },
  })
  async getWalletsSummary(
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<WalletSummaryResponseDto>> {
    const data = await this.service.getWalletsSummary(requestLogger);
    return BaseResponseDto.success(
      data,
      requestId,
      "Wallets summary fetched successfully",
    );
  }
}
