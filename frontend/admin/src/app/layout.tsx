import type { Metadata } from "next";
import { Figtree, Geist, Urbanist } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/src/components/layout/MainLayout";
import { cn } from "@/src/lib/utils";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
});

export const metadata: Metadata = {
  title: "Airbook Admin",
  description: "FlyVoid Airbook Admin Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", figtree.variable, geist.variable, urbanist.variable)}>
      <body className={`${figtree.className} min-h-screen flex flex-col antialiased`}>
        <TooltipProvider>
          <MainLayout>{children}</MainLayout>
        </TooltipProvider>
        <ToastContainer position="top-right" autoClose={3000} />
      </body>
    </html>
  );
}