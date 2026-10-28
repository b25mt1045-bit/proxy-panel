import Link from "next/link";

import { Lockup } from "@/components/Mark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Proxy Panel home">
          <Lockup />
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/#how" className="hidden hover:text-pop sm:block">
            How it works
          </Link>
          <Link href="/#brief" className="rounded-xl bg-text px-4 py-2 text-ink transition-colors hover:bg-pop">
            Start your brief
          </Link>
        </nav>
      </div>
    </header>
  );
}
