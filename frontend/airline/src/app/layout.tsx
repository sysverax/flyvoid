import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/src/components/layout/MainLayout";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

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
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className={`${figtree.className} font-figtree min-h-screen flex flex-col antialiased`}>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
