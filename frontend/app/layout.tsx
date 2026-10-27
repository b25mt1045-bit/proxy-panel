import type { Metadata } from "next";
import { Averia_Serif_Libre, Caveat, Inter } from "next/font/google";

import { Header } from "@/components/Header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const averia = Averia_Serif_Libre({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-averia" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Proxy Panel",
  description: "Test a product idea on six shoppers built from real Qloo taste data, before you launch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${averia.variable} ${caveat.variable} antialiased`}>
      <body className="font-sans">
        <Header />
        <main id="top">{children}</main>
        <footer className="border-t-2 border-text print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-sub sm:px-8">
            <p>These are hypotheses about segments and objections, not a sales forecast.</p>
            <p>Built on Qloo taste data.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
