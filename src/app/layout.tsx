import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import { AuthProvider } from "@/lib/AuthProvider";
import "./globals.css";

const retroFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "REDKART — Retro Racing",
  description: "Brutalist retro kart racing in the browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={retroFont.className} suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
