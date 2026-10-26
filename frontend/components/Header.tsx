import { Lockup } from "@/components/Mark";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-text bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" aria-label="Proxy Panel, back to top">
          <Lockup />
        </a>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <a href="#how" className="hidden hover:text-pop sm:block">
            How it works
          </a>
          <a href="#brief" className="rounded-full bg-text px-4 py-2 text-ink transition-colors hover:bg-pop">
            Start your brief
          </a>
        </nav>
      </div>
    </header>
  );
}
