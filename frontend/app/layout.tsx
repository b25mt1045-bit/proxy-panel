import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Proxy Panel",
  description: "A pre-launch focus group of personas built from Qloo taste data.",
};

function Mark() {
  // Six seats around one table: the panel.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="var(--hue)" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={10 + 8 * Math.cos((a * Math.PI) / 180)} cy={10 + 8 * Math.sin((a * Math.PI) / 180)}
                r="1.6" fill="var(--text)" />
      ))}
    </svg>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="h-12 border-b border-border bg-surface">
          <div className="mx-auto flex h-full max-w-[1088px] items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-[15px] font-medium">
              <Mark /> Proxy Panel
            </Link>
            <Link href="/" className="text-muted hover:text-ink">New brief</Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1088px] px-4 pt-8 pb-24">{children}</main>
      </body>
    </html>
  );
}
