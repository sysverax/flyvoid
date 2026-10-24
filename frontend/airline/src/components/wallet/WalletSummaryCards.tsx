"use client";

import { CreditCard, Lock, Wallet as WalletIcon, Coins } from "lucide-react";
import { formatMoney, walletFigures } from "@/src/lib/wallet-figures";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import { StatCard } from "@/src/components/ui/StatCard";
import { CreditUsageBar } from "./CreditUsageBar";

const ICON_CLASS = "h-5.5 w-6 text-blue-950 stroke-[1.8]";
const NEGATIVE_CLASS = "text-[#C83833]";

/** Account summary for the Wallet page: available, balance, credit limit, reserved. */
export function WalletSummaryCards() {
  const { wallet } = useWalletBalance();
  const figures = wallet ? walletFigures(wallet) : null;
  const show = (value: number | undefined) =>
    value === undefined ? "—" : formatMoney(value);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        title="Available to Spend"
        value={show(figures?.available)}
        valueClassName={figures && figures.available < 0 ? NEGATIVE_CLASS : undefined}
        hint="Balance + credit limit − reserved"
        icon={<Coins className={ICON_CLASS} />}
      />
      <StatCard
        title="Balance"
        value={show(figures?.balance)}
        valueClassName={figures && figures.balance < 0 ? NEGATIVE_CLASS : undefined}
        hint={
          figures && figures.balance < 0
            ? "Outstanding — paid from credit"
            : "Funds in your wallet"
        }
        icon={<WalletIcon className={ICON_CLASS} />}
      />
      <StatCard
        title="Credit Limit"
        value={show(figures?.creditLimit)}
        hint={
          figures && figures.creditLimit > 0 ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-2">
                <CreditUsageBar percent={figures.creditUsedPercent} />
                <span className="shrink-0 tabular-nums">
                  {Math.round(figures.creditUsedPercent)}%
                </span>
              </div>
              <div>
                {formatMoney(figures.creditUsed)} of{" "}
                {formatMoney(figures.creditLimit)} used
              </div>
            </div>
          ) : (
            "No credit limit"
          )
        }
        icon={<CreditCard className={ICON_CLASS} />}
      />
      <StatCard
        title="Reserved"
        value={show(figures?.reserved)}
        hint="Held for hotel allocations still booking"
        icon={<Lock className={ICON_CLASS} />}
      />
    </div>
  );
}
