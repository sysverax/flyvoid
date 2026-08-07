"use client";

import { Sidebar } from "./Sidebar";
import { cn } from "@/src/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { authService } from "@/src/services/auth.service";
import { NAVIGATION_ITEMS, getModuleKey } from "@/src/lib/navigation";
import { useEffect, useState } from "react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    setUser(authService.getCurrentUser());
  }, [pathname]);

  const isAuthPage = pathname === "/login" || pathname === "/forgot-password" || pathname === "/verify";

  // Guard routing check & access redirect
  useEffect(() => {
    if (mounted && !isAuthPage) {
      if (!authService.isLoggedIn()) {
        router.push("/login");
        return;
      }

      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        const moduleKey = getModuleKey(pathname);
        if (moduleKey) {
          if (!authService.hasPermission("view", pathname)) {
            // Find first tab with view permission
            const firstAllowedTab = NAVIGATION_ITEMS.find((tab) =>
              authService.hasPermission("view", tab.path)
            );

            if (firstAllowedTab) {
              router.push(firstAllowedTab.path);
            } else {
              // No view access to any tab, force logout
              authService.logout();
              router.push("/login");
            }
          }
        }
      }
    }
  }, [mounted, isAuthPage, pathname, router]);

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
        <div className="animate-spin h-8 w-8 text-primary border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
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
