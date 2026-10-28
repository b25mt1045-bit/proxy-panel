import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";

import { Header } from "@/components/Header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const slab = Roboto_Slab({ subsets: ["latin"], variable: "--font-slab" });

export const metadata: Metadata = {
  title: "Proxy Panel",
  description: "Test a product idea on six shoppers built from real Qloo taste data, before you launch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${slab.variable} antialiased`}>
      <body className="font-sans">
        <Header />
        <main id="top">{children}</main>
        <footer className="border-t border-line print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-sub sm:px-8">
            <p>These are hypotheses about segments and objections, not a sales forecast.</p>
            <p>Built on Qloo taste data.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
