import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArcSwarm - Autonomous Treasury Management",
  description:
    "Multi-agent USDC treasury management on Arc. AI agents handle yield, liquidity, payments, and FX strategies autonomously.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
