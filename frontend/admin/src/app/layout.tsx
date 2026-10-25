import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/src/components/layout/MainLayout";
import { cn } from "@/src/lib/utils";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// The only font (same as the airline portal). globals.css maps font-sans and
// font-figtree to this variable; it has its own name so the theme variables
// do not refer to themselves.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree-family",
});

export const metadata: Metadata = {
  title: "Flyverax Admin",
  description: "Flyverax Admin Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", figtree.variable)}>
      <body className={`${figtree.className} min-h-screen flex flex-col antialiased`}>
        <TooltipProvider>
          <MainLayout>{children}</MainLayout>
        </TooltipProvider>
        <ToastContainer position="top-right" autoClose={3000} />
      </body>
    </html>
  );
}