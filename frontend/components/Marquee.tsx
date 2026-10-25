// The audiences and categories a panel can be built for (the real presets), drifting past.
const ITEMS = [
  "Gen Z urban fitness",
  "Beverage",
  "Health-conscious parents",
  "Personal care",
  "Millennial wellness professionals",
  "Apparel",
  "Budget-minded students",
  "Consumer apps",
  "Or describe your own audience",
];

export function Marquee() {
  return (
    <section aria-label="Audiences and categories" className="relative border-y border-line py-6">
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <ul className="flex w-max motion-safe:animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused]">
          {[...ITEMS, ...ITEMS].map((t, i) => (
            <li key={i} aria-hidden={i >= ITEMS.length} className="flex items-center whitespace-nowrap">
              <span className={`px-8 text-[15px] ${i % 2 ? "accent text-[17px] text-sub" : "text-faint"}`}>{t}</span>
              <span aria-hidden className="size-1 rounded-full bg-gold/60" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
