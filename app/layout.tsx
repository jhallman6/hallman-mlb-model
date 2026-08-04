import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Hallman MLB Model — Daily Lineups", description: "Automated daily MLB lineups and starting pitchers for The Hallman Algo." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
