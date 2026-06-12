import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dinex Bot — AI Waiter",
  description: "Voice-first AI restaurant waiter robot system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
