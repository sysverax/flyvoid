"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { cn } from "@/src/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const authRoutes = ["/login", "/forgot-password", "/two-factor", "/onboard", "/verify"];
  const isAuthPage = authRoutes.some(
    (route) => pathname === route || pathname.endsWith(`/airline${route}`)
  );

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-[#F3F4F6] flex flex-col justify-center items-center">
        {children}
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="min-h-screen w-full bg-[#F3F4F6] flex flex-col justify-center items-center">
        <div className="animate-spin h-8 w-8 text-[#0F2757] border-4 border-[#0F2757] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-all duration-300 pt-16 lg:pt-0 lg:ml-[240px]"
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8 w-full">{children}</div>
      </main>
    </div>
  );
}
