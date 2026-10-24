"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { walletService, WalletBalanceDTO } from "@/src/services/wallet.service";
import { WALLET_BALANCE_CHANGED_EVENT } from "@/src/lib/wallet-events";

/**
 * The airline's wallet (GET /wallets/balance). Reloads on every page change
 * and whenever WALLET_BALANCE_CHANGED_EVENT fires. Pass enabled=false for
 * users without Wallet view access (the API answers 403 for them).
 */
export function useWalletBalance(enabled = true) {
  const pathname = usePathname();
  const [wallet, setWallet] = useState<WalletBalanceDTO | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () =>
      walletService
        .getWalletBalance()
        .then((data) => active && setWallet(data))
        .catch((err) => console.error("Failed to load wallet balance:", err))
        .finally(() => active && setIsLoading(false));
    load();
    window.addEventListener(WALLET_BALANCE_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(WALLET_BALANCE_CHANGED_EVENT, load);
    };
  }, [enabled, pathname]);

  return { wallet, isLoading };
}
