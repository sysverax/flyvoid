import type { Metadata } from "next";
import { Figtree, Geist } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/src/components/layout/MainLayout";
import { cn } from "@/src/lib/utils";
import { TooltipProvider } from "@radix-ui/react-tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const figtree = Figtree({
  subsets: ["latin"],
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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${figtree.className} min-h-screen flex flex-col antialiased`}>
        <TooltipProvider>
          <MainLayout>{children}</MainLayout>
        </TooltipProvider>
      </body>
    </html>
  );
}