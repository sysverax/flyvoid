import type { WalletBalanceDTO } from "@/src/services/wallet.service";

/** What the wallet can do, from GET /wallets/balance. */
export interface WalletFigures {
  balance: number;
  creditLimit: number;
  /** lockedAmount: held for hotel allocation runs still booking. */
  reserved: number;
  /** balance + creditLimit − reserved: what a new allocation may lock. */
  available: number;
  /** Credit being drawn on: the part of the balance below what is reserved. */
  creditUsed: number;
  /** creditUsed as a share of creditLimit, 0–100. */
  creditUsedPercent: number;
}

export function walletFigures(wallet: WalletBalanceDTO): WalletFigures {
  const balance = Number(wallet.balance ?? 0);
  const creditLimit = Number(wallet.creditLimit ?? 0);
  const reserved = Number(wallet.lockedAmount ?? 0);
  // Same rule as the admin wallets summary (wallet.repository.ts).
  const creditUsed = Math.max(0, reserved - balance);
  return {
    balance,
    creditLimit,
    reserved,
    available: balance + creditLimit - reserved,
    creditUsed,
    creditUsedPercent:
      creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0,
  };
}

/** "$1,234.56", or "–$1,234.56" when negative. */
export function formatMoney(value: number): string {
  return `${value < 0 ? "–" : ""}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
