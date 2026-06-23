"use client";

import { Sidebar } from "./Sidebar";
import { cn } from "@/src/lib/utils";
import { usePathname } from "next/navigation";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/forgot-password";

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-[#F3F4F6] flex flex-col justify-center items-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-all duration-300 pt-16 lg:pt-0 lg:ml-60",
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8 w-full">{children}</div>
      </main>
    </div>
  );
}
