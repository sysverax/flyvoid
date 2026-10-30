"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { walletService, WalletBalanceDTO } from "@/src/services/wallet.service";
import { WALLET_BALANCE_CHANGED_EVENT } from "@/src/lib/wallet-events";

let cachedWallet: WalletBalanceDTO | null = null;
let inflight: Promise<WalletBalanceDTO | null> | null = null;

function loadWalletBalance(): Promise<WalletBalanceDTO | null> {
  if (inflight) return inflight;
  inflight = walletService
    .getWalletBalance()
    .then((data) => {
      cachedWallet = data;
      return data;
    })
    .catch((err) => {
      console.error("Failed to load wallet balance:", err);
      return cachedWallet;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * The airline's wallet (GET /wallets/balance). Reloads on every page change
 * and whenever WALLET_BALANCE_CHANGED_EVENT fires. Pass enabled=false for
 * users without Wallet view access (the API answers 403 for them).
 */
export function useWalletBalance(enabled = true) {
  const pathname = usePathname();
  const [wallet, setWallet] = useState<WalletBalanceDTO | null>(cachedWallet);
  const [isLoading, setIsLoading] = useState(enabled && !cachedWallet);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    let active = true;
    const load = () => {
      if (!cachedWallet) setIsLoading(true);
      return loadWalletBalance().then((data) => {
        if (!active) return;
        setWallet(data);
        setIsLoading(false);
      });
    };
    load();
    window.addEventListener(WALLET_BALANCE_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(WALLET_BALANCE_CHANGED_EVENT, load);
    };
  }, [enabled, pathname]);

  return { wallet, isLoading };
}
