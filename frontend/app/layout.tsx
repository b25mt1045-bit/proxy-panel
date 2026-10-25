import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";

import { Ambient } from "@/components/Ambient";
import { Header } from "@/components/Header";
import { Intro } from "@/components/Intro";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-bodoni" });

export const metadata: Metadata = {
  title: "Proxy Panel",
  description: "A focus group in 90 seconds whose panelists' opinions come from real taste data, not an LLM's imagination.",
};

// Runs before first paint: play the intro once per session, never under reduced motion.
const INTRO_GATE = `try{if(!sessionStorage.getItem("pp-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="play"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${hanken.variable} ${bodoni.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
      </head>
      <body className="font-sans">
        <SmoothScroll />
        <Ambient />
        <Intro />
        <Header />
        <main id="top" className="relative z-10">
          {children}
        </main>
        <footer className="relative z-10 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-faint sm:px-8">
            <p>These are hypotheses about segments and objections, not a sales forecast.</p>
            <p>Built on Qloo taste data.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
