"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { SignOutDialog } from "./SignOutDialog";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/", key: "dashboard" },
  { title: "Airports", icon: "/icons/plane1.svg", path: "/airports", key: "airports" },
  { title: "Cancelled Flights", icon: "/icons/cancel.svg", path: "/cancellation", key: "cancellation" },
  { title: "Bookings", icon: Plane, path: "/bookings", key: "bookings" },
  { title: "Billing", icon: "/icons/payment.svg", path: "/billing", key: "billing" },
  { title: "Settings", icon: Settings, path: "/settings", key: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const handleLogout = () => {
    setSignOutOpen(true);
  };

  const confirmLogout = () => {
    setSignOutOpen(false);
    sessionStorage.removeItem("airline_current_user");
    router.push("/login");
  };

  const renderNavContent = (mobile = false) => (
    <div className="flex h-full w-full flex-col gap-8 text-[18px] text-[#9FA9BC]">
      {/* Logo */}
      <div className="relative h-14 w-full">
        <Image
          src="/logo.svg"
          alt="Airbook logo"
          width={142}
          height={37}
          className="absolute -top-1 left-[14px]"
          priority
        />

        {mobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between pb-0">
        {/* Navigation */}
        <nav className="scrollbar-hide flex-1 overflow-y-auto">
          <div className="flex w-full flex-col items-start gap-3">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group flex h-[46px] w-full items-center gap-3 rounded-[10px] px-4 py-3 text-[18px] leading-[22px] transition-colors duration-200",
                    isActive
                      ? "bg-[#203663] text-white"
                      : "text-[#9FA9BC] hover:bg-[#203663]/50 hover:text-white",
                  )}
                >
                  {typeof item.icon === "string" ? (
                    <Image
                      src={item.icon}
                      alt={item.title}
                      width={20}
                      height={20}
                      className={cn(
                        "h-5 w-5 transition-all duration-200",
                        isActive
                          ? "brightness-0 invert"
                          : "opacity-90 group-hover:brightness-0 group-hover:invert",
                      )}
                    />
                  ) : (
                    <item.icon className="h-5 w-5" strokeWidth={1.8} />
                  )}
                  <span className="flex-1">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="w-full mt-1.5">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-[10px] px-4 py-3 text-[18px] leading-[22px] text-[#9FA9BC] transition-colors duration-200 hover:bg-[#203663]/50 hover:text-white cursor-pointer"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-left flex-1">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg bg-white p-2 shadow"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-screen w-[240px] flex-col bg-[#0F2757] px-4 py-8">
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-[#0F2757] px-4 py-8 lg:flex",
        )}
      >
        {renderNavContent()}
      </aside>

      <SignOutDialog
        isOpen={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}
