/**
 * Fired when the wallet balance may have changed (for example after hotel
 * allocation, which charges each booked PNR), so the top bar reloads it.
 */
export const WALLET_BALANCE_CHANGED_EVENT = "flyvoid:wallet-balance-changed";

export function notifyWalletBalanceChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WALLET_BALANCE_CHANGED_EVENT));
  }
}
