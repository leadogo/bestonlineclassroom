import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

/** Designed for low-vision readers: unambiguous letterforms at the sizes phones use. One family for everything. */
const font = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "AI For Agents Masterclass",
  description: "Live session room.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0e1116", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${font.className} h-full bg-room text-ink`}>
      <body className="min-h-full text-[16px] antialiased">{children}</body>
    </html>
  );
}
