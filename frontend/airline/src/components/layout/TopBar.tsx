"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, Wallet as WalletIcon } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/src/lib/utils";
import { TOP_BAR_HEIGHT_CLASS } from "@/src/lib/layout";
import { WALLET_BALANCE_CHANGED_EVENT } from "@/src/lib/wallet-events";
import { useAuth } from "@/src/hooks/useAuth";
import { authService } from "@/src/services/auth.service";
import { walletService } from "@/src/services/wallet.service";
import { SignOutDialog } from "./SignOutDialog";

const ROLE_LABELS: Record<string, string> = {
  AIRLINE_ADMIN: "Admin",
  AIRLINE_STAFF: "Staff",
};

const formatMoney = (value: number) =>
  `${value < 0 ? "–" : ""}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Wallet balance (users with Wallet view only) and profile menu, on every page. */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canViewWallet = hasPermission("view", "/wallet");

  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reload on every page change and whenever the balance may have changed.
  useEffect(() => {
    if (!canViewWallet) return;
    let active = true;
    const load = () =>
      walletService
        .getWalletBalance()
        .then((data) => active && setBalance(Number(data.balance ?? 0)))
        .catch((err) => console.error("Failed to load wallet balance:", err));
    load();
    window.addEventListener(WALLET_BALANCE_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(WALLET_BALANCE_CHANGED_EVENT, load);
    };
  }, [canViewWallet, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authService.logout();
      setSignOutOpen(false);
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";
  const initials =
    ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase() ||
    (user?.email?.[0] ?? "").toUpperCase();
  const roleLabel = ROLE_LABELS[user?.role ?? ""] ?? "";

  return (
    <>
      {/* pl-16 on mobile leaves room for the sidebar's menu button */}
      {/* Page titles are in the pages (PageHeader); the bar holds the balance and profile. */}
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-end gap-4 border-b border-[#E5E7EB] bg-white pl-16 pr-4 sm:pr-6 lg:px-8",
          TOP_BAR_HEIGHT_CLASS,
        )}
      >
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          {canViewWallet && (
            <Link
              href="/wallet"
              title="Open wallet"
              className="hidden sm:flex items-center gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2 hover:bg-gray-100 transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-white text-[#4B5563] border border-[#E5E7EB]">
                <WalletIcon className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Wallet Balance
                </span>
                <span
                  className={cn(
                    "text-[16px] font-bold",
                    balance !== null && balance < 0
                      ? "text-[#C83833]"
                      : "text-[#1F2937]",
                  )}
                >
                  {balance === null ? "—" : formatMoney(balance)}
                </span>
              </span>
            </Link>
          )}

          {user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F2757] text-[14px] font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden md:flex flex-col items-start text-left">
                  <span className="text-[15px] font-semibold text-[#1F2937] max-w-[160px] truncate">
                    {fullName}
                  </span>
                  {roleLabel && (
                    <span className="text-[13px] text-[#6B7280]">{roleLabel}</span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-[#6B7280] transition-transform",
                    menuOpen && "rotate-180",
                  )}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded-lg bg-white p-1.5 shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)] outline outline-1 outline-gray-200 z-50"
                >
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <div className="text-[14px] font-semibold text-[#1F2937] truncate">
                      {fullName}
                    </div>
                    <div className="text-[12px] text-[#6B7280] truncate">
                      {user.email}
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] text-[#374151] hover:bg-gray-100"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setSignOutOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[14px] text-[#374151] hover:bg-gray-100 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <SignOutDialog
        isOpen={signOutOpen}
        isSigningOut={isSigningOut}
        onClose={() => setSignOutOpen(false)}
        onConfirm={confirmSignOut}
      />
    </>
  );
}
