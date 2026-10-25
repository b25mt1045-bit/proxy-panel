import type { Metadata } from "next";
import { Archivo, Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "Proxy Panel",
  description: "A focus group in 90 seconds whose panelists' opinions come from real taste data, not an LLM's imagination.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${barlow.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2" aria-label="Proxy Panel home">
              <span className="tag flex items-center gap-1.5 bg-live px-2 py-0.5 text-sm text-white">
                <span aria-hidden className="size-1.5 rounded-full bg-white motion-safe:animate-[blink_1.4s_steps(1)_infinite]" />
                Live
              </span>
              <span className="display text-2xl not-italic tracking-wide text-white">Proxy Panel</span>
            </Link>
            <a
              href="#brief"
              className="tag hidden border-2 border-white px-4 py-1.5 text-sm text-white transition-colors hover:bg-white hover:text-ink sm:block"
            >
              Brief the panel
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-navy">
          <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-faint sm:px-6">
            Proxy Panel gives hypotheses about segments and objections, not a sales forecast. Built on Qloo taste data.
          </p>
        </footer>
      </body>
    </html>
  );
}
