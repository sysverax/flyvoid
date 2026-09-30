"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { authService, User } from "@/src/services/auth.service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setUser(authService.getCurrentUser());
    setLoading(false);
  }, []);

  const hasPermission = (permission: "view" | "edit" | "export", customPath?: string): boolean => {
    return authService.hasPermission(permission, customPath || pathname);
  };

  return {
    user,
    loading,
    isLoggedIn: !!user,
    hasPermission,
  };
}
