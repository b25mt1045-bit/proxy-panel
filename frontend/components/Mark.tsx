const SEATS = ["var(--color-sky)", "var(--color-sun)", "var(--color-mint)", "var(--color-peach)", "var(--color-tomato)", "var(--color-lilac)"];

/** The Proxy Panel mark: six seats around a table, one per panelist. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className}>
      <circle cx="20" cy="20" r="7.5" fill="none" stroke="var(--color-text)" strokeWidth="1.6" />
      {SEATS.map((fill, i) => {
        const a = ((i * 60 - 90) * Math.PI) / 180;
        return (
          <circle
            key={i}
            cx={(20 + 13.5 * Math.cos(a)).toFixed(2)}
            cy={(20 + 13.5 * Math.sin(a)).toFixed(2)}
            r="3.6"
            fill={fill}
            stroke="var(--color-text)"
            strokeWidth="1.2"
          />
        );
      })}
    </svg>
  );
}

export function Lockup({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Mark className="size-8" />
      <span className="font-serif text-xl font-bold tracking-[-0.01em]">Proxy Panel</span>
    </span>
  );
}
