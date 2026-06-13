"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/src/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {

  return (
    <div className="min-h-screen w-full bg-background">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-all duration-300 pt-16 lg:pt-0 lg:ml-60",
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
