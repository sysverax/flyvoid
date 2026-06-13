"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Plane,
  FileText,
  LogOut,
  Menu,
  X,
  Users ,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Airlines", icon: Plane, path: "/airlines" },
  { title: "Cancellation", icon: "/icons/cancel.svg", path: "/cancellation" },
  { title: "Payments", icon: "/icons/payment.svg", path: "/payments" },
  { title: "Onboarding", icon: "/icons/onboarding.svg", path: "/onboarding" },
  { title: "Audit Logs", icon: FileText, path: "/audit-logs" },
  { title: "Manage Users", icon: Users , path: "/manage-users" },
  { title: "Admin Profile", icon: "/icons/user.svg", path: "/profile" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    router.push("/auth");
  };

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between h-20 px-6 mb-3">
        <Image src="/logo.svg" alt="Logo" width={142} height={37} />

        {mobile && (
          <button onClick={() => setMobileOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-[18px] rounded-lg transition-all duration-200",
                "hover:bg-white/10",
                isActive ? "bg-white/15 text-white" : "text-[#9FA9BC]",
              )}
            >
              {typeof item.icon === "string" ? (
                <Image
                  src={item.icon}
                  alt={item.title}
                  width={20}
                  height={20}
                />
              ) : (
                <item.icon className="w-5 h-5" />
              )}
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-3">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-4 py-3 text-[18px] rounded-lg transition-all duration-200 w-full",
            "text-[#9FA9BC] hover:bg-white/10",
          )}
        >
          <LogOut className="w-5 h-5" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 bg-white rounded-lg shadow"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 bg-primary">
            <NavContent mobile />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-primary border-r border-white/10 transition-all duration-300 z-40 w-60",
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
