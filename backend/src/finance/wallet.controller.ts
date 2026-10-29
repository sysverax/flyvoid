import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
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
  CreditLimitHistoryResponseDto,
  CreditLimitUpdateResponseDto,
  UpdateCreditLimitRequestDto,
  CreateWalletAdjustmentRequestDto,
  GetWalletTransactionsQueryDto,
  WalletAdjustmentResponseDto,
  WalletBalanceResponseDto,
  WalletSummaryResponseDto,
  GetWalletsSummaryQueryDto,
  WalletTransactionListResponseDto,
} from "./dto";

@ApiTags("Wallets")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RbacGuard)
@RequireUserTypes(UserType.PLATFORM, UserType.AIRLINE)
@Controller("wallets")
@ApiExtraModels(
  CreditLimitUpdateResponseDto,
  CreditLimitHistoryResponseDto,
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

  // ── PATCH /wallets/:airlineId/credit-limit ───────────────────────────────
  @Patch(":airlineId/credit-limit")
  @RequireUserTypes(UserType.PLATFORM)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRLINES,
      access: [AccessAction.EDIT],
    },
  })
  @ApiOperation({
    summary: "Update an airline's credit limit",
    description:
      "Platform users with AIRLINES EDIT. Sets an onboarded airline's credit limit to any amount >= 0 (up to 2 decimals) and records previous/new/reason/admin in the credit limit history; reason is required. The limit may be set below what the airline already uses: availableBalance (balance + creditLimit - lockedAmount) then goes negative and new hotel allocations are blocked until the wallet is topped up. Allocation runs already holding their wallet lock are not affected. No wallet transaction is created (not a balance movement). The wallet row is locked during the update. 400 when the value equals the current limit; 404 when the airline has no wallet (not onboarded yet).",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(CreditLimitUpdateResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/wallets/5/credit-limit",
      "Wallet not found for airline '5'",
    ),
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/wallets/5/credit-limit"),
  })
  async updateCreditLimit(
    @Req() req: AuthenticatedRequest,
    @Param("airlineId", ParseIntPipe) airlineId: number,
    @Body() dto: UpdateCreditLimitRequestDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<CreditLimitUpdateResponseDto>> {
    requestLogger.info("Updating airline credit limit", {
      context: this.context,
      airlineId,
      dto,
    });
    const data = await this.service.updateCreditLimit(
      req.user,
      airlineId,
      dto,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Credit limit updated successfully",
    );
  }

  // ── GET /wallets/:airlineId/credit-limit/history ─────────────────────────
  @Get(":airlineId/credit-limit/history")
  @RequireUserTypes(UserType.PLATFORM)
  @RequireAccessControl({
    platform: {
      asset: PlatformAsset.AIRLINES,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Credit limit history of an airline",
    description:
      "Platform users with AIRLINES VIEW. The wallet's current creditLimit, balance, lockedAmount and availableBalance, plus every credit limit change, newest first, including the initial limit set at onboarding: previous and new limit, reason, admin (id, name, email) and time. Not paginated.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(CreditLimitHistoryResponseDto) },
      },
    },
  })
  @ApiNotFoundResponse({
    schema: createNotFoundErrorSchema(
      "/api/v1/wallets/5/credit-limit/history",
      "Wallet not found for airline '5'",
    ),
  })
  async getCreditLimitHistory(
    @Param("airlineId", ParseIntPipe) airlineId: number,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<CreditLimitHistoryResponseDto>> {
    const data = await this.service.getCreditLimitHistory(
      airlineId,
      requestId,
      requestLogger,
    );
    return BaseResponseDto.success(
      data,
      requestId,
      "Credit limit history fetched successfully",
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
      "Returns paginated wallet transaction (ledger) history with optional filters: search (partial match on transaction id), airlineId (platform users only), type (ADJUSTMENT or BOOKING), status, startDate/endDate (transaction creation time; ISO 8601 timestamps with timezone, start inclusive, end exclusive). Platform users see all airlines by default; airline users only ever see their own.",
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
  @RequireAccessControl({
    airline: {
      asset: AirlineAsset.WALLET,
      access: [AccessAction.VIEW],
    },
  })
  @ApiOperation({
    summary: "Get wallet balance",
    description:
      "Returns wallet balance and credit details of the airline user's own wallet. Requires VIEW access on the WALLET asset (airline admins always have it).",
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
      "Platform-only. Returns the number of airlines, the number of active airlines (active and not suspended), total wallet balance, total credit issued and total credit used. Accepts the same filters as the admin airline list (GET /airline): search (airline name or code), countryCode, isActive, isSuspended; without filters it covers all airlines.",
  })
  @ApiOkResponse({
    schema: {
      properties: {
        success: { type: "boolean", example: true },
        data: { $ref: getSchemaPath(WalletSummaryResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: createBadRequestErrorSchema("/api/v1/wallets/summary"),
  })
  async getWalletsSummary(
    @Query() query: GetWalletsSummaryQueryDto,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<BaseResponseDto<WalletSummaryResponseDto>> {
    const data = await this.service.getWalletsSummary(query, requestLogger);
    return BaseResponseDto.success(
      data,
      requestId,
      "Wallets summary fetched successfully",
    );
  }
}
