import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI For Agents Masterclass",
  description: "Live session room.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0f14", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full bg-[#0b0f14] text-slate-100">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
