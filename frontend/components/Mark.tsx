/** The Proxy Panel mark: six seats around a table, one per panelist. */
export function Mark({ className = "", ring = "var(--color-line-2)", outline = false }: { className?: string; ring?: string; outline?: boolean }) {
  const seats = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    return [20 + 13.5 * Math.cos(a), 20 + 13.5 * Math.sin(a)] as const;
  });
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className}>
      <circle data-ring cx="20" cy="20" r="7.5" fill="none" stroke={ring} strokeWidth="1.2" pathLength={1} vectorEffect={outline ? "non-scaling-stroke" : undefined} />
      {seats.map(([x, y], i) => (
        <circle
          data-seat
          key={i}
          cx={x.toFixed(2)}
          cy={y.toFixed(2)}
          r="3"
          fill={outline ? "none" : "var(--color-gold)"}
          stroke={outline ? "var(--color-gold)" : undefined}
          strokeWidth={outline ? 1 : undefined}
          vectorEffect={outline ? "non-scaling-stroke" : undefined}
        />
      ))}
    </svg>
  );
}

export function Lockup({ id, className = "" }: { id?: string; className?: string }) {
  return (
    <span id={id} className={`flex items-center gap-2.5 ${className}`}>
      <Mark className="size-7" />
      <span data-word className="text-[17px] font-medium tracking-[-0.01em] text-text">
        Proxy Panel
      </span>
    </span>
  );
}
