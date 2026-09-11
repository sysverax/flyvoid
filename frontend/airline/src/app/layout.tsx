import type { Metadata } from "next";
import "./globals.css";
import { MainLayout } from "@/src/components/layout/MainLayout";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const metadata: Metadata = {
  title: "Airbook - Airline Portal",
  description: "Airline Management Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans min-h-screen flex flex-col antialiased">
        <TooltipProvider>
          <MainLayout>{children}</MainLayout>
        </TooltipProvider>
        <ToastContainer position="top-right" autoClose={3000} />
      </body>
    </html>
  );
}
