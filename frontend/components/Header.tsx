"use client";

import { useEffect, useState } from "react";

import { Lockup } from "@/components/Mark";
import { scrollToId } from "@/lib/motion";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToId(id);
  };

  return (
    <header
      className={`site-header fixed inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-500 ${
        scrolled ? "border-b border-line bg-bg/90" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" onClick={go("top")} aria-label="Proxy Panel, back to top">
          <Lockup id="site-lockup" />
        </a>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#how" onClick={go("how")} className="hidden text-sub transition-colors hover:text-text sm:block">
            How it works
          </a>
          <a
            href="#brief"
            onClick={go("brief")}
            className="rounded-full border border-line-2 px-4 py-1.5 text-text transition-colors hover:border-gold hover:text-gold"
          >
            Brief the panel
          </a>
        </nav>
      </div>
    </header>
  );
}
