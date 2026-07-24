import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { DashboardProvider } from "@/lib/store";
import "./globals.css";

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ArenaFlowCluster — Cluster Intelligence",
  description: "Predictive AI for real-time game server cluster intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${mono.variable}`}>
      <body>
        <DashboardProvider>{children}</DashboardProvider>
      </body>
    </html>
  );
}
