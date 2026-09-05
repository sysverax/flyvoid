"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { cn } from "@/src/lib/utils";
import { refreshAccessToken } from "@/src/lib/api-client";

interface MainLayoutProps {
  children: React.ReactNode;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isPublicPath(pathname: string): boolean {
  const normalizedPath = normalizePath(pathname);
  return normalizedPath === "/auth" || normalizedPath.startsWith("/auth/");
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isAuthPage = isPublicPath(pathname);

  useEffect(() => {
    if (isAuthPage) {
      setAuthStatus("authenticated");
      return;
    }

    if (!isClient) {
      setAuthStatus("loading");
      return;
    }

    let active = true;

    const resolveAuth = async () => {
      setAuthStatus("loading");
      const accessToken = sessionStorage.getItem("airline_access_token");

      if (accessToken) {
        if (active) {
          setAuthStatus("authenticated");
        }
        return;
      }

      const refreshedToken = await refreshAccessToken();
      if (!active) {
        return;
      }

      setAuthStatus(refreshedToken ? "authenticated" : "unauthenticated");
    };

    void resolveAuth();

    return () => {
      active = false;
    };
  }, [isAuthPage, isClient, pathname]);

  useEffect(() => {
    if (!isClient || isAuthPage || authStatus !== "unauthenticated") {
      return;
    }

    const query = typeof window !== "undefined" ? window.location.search : "";
    const currentPath = `${pathname}${query ? `?${query}` : ""}`;
    const target = encodeURIComponent(currentPath || "/");
    router.replace(`/auth/login?redirect=${target}`);
  }, [isClient, isAuthPage, authStatus, pathname, router]);

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-[#F3F4F6] flex flex-col justify-center items-center">
        {children}
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="min-h-screen w-full bg-[#F3F4F6] flex flex-col justify-center items-center">
        <div className="animate-spin h-8 w-8 text-[#0F2757] border-4 border-[#0F2757] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (authStatus === "loading" || authStatus === "unauthenticated") {
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
          "min-h-screen transition-all duration-300 pt-16 lg:pt-0 lg:ml-[240px]",
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8 w-full">{children}</div>
      </main>
    </div>
  );
}
