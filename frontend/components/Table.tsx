/** The six-seat table drawn at one stage of a run: 0 brief, 1 brands, 2 debate, 3 verdict. Sample data, labelled where used. */

type Stance = "Enthusiast" | "Conditional" | "Skeptic";
const STANCES: Stance[] = ["Enthusiast", "Conditional", "Enthusiast", "Skeptic", "Conditional", "Skeptic"];
const FILL: Record<Stance, string> = { Enthusiast: "#8fcfa6", Conditional: "#e3bd78", Skeptic: "#e8928a" };
const C = 200;
const at = (r: number, deg: number) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)] as const;
const SEATS = STANCES.map((_, i) => at(128, i * 60 - 90));
const LABELS = STANCES.map((_, i) => at(166, i * 60 - 90));
const BRANDS = [0, 72, 144, 216, 288].map((d) => at(44, d - 90));
// Who answers whom in the debate: each line is one exchange.
const CHORDS: [number, number][] = [
  [0, 3],
  [1, 4],
  [2, 5],
  [3, 5],
  [0, 2],
];
const WINNERS = [0, 1]; // the Gen Z urban fitness pair

export function Table({ stage, className = "" }: { stage: 0 | 1 | 2 | 3; className?: string }) {
  const seatFill = (i: number) =>
    stage < 2 ? (stage === 0 ? "#34373d" : "#7f7b74") : stage === 3 && WINNERS.includes(i) ? "#d9c08c" : FILL[STANCES[i]];
  const dim = (i: number) => stage === 3 && !WINNERS.includes(i);
  return (
    <svg viewBox="0 0 400 400" aria-hidden className={className}>
      <circle cx={C} cy={C} r="72" fill="none" stroke="var(--color-line-2)" strokeWidth="1" />
      <circle cx={C} cy={C} r="160" fill="none" stroke="var(--color-line)" strokeWidth="1" strokeDasharray="2 6" />
      {stage === 2 &&
        CHORDS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            data-chord
            pathLength={1}
            x1={SEATS[a][0]}
            y1={SEATS[a][1]}
            x2={SEATS[b][0]}
            y2={SEATS[b][1]}
            stroke="var(--color-sub)"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        ))}
      {(stage === 1 || stage === 2) &&
        BRANDS.map(([x, y], i) => (
          <circle
            key={i}
            data-brand
            cx={x}
            cy={y}
            r="5"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.5"
            opacity={stage === 2 ? 0.35 : 1}
          />
        ))}
      {SEATS.map(([x, y], i) => (
        <circle key={i} data-seat cx={x} cy={y} r={stage === 3 && !dim(i) ? 13 : 10} fill={seatFill(i)} opacity={dim(i) ? 0.25 : 1} />
      ))}
      {stage >= 2 &&
        LABELS.map(([x, y], i) => (
          <text
            key={i}
            x={x}
            y={y + 4}
            textAnchor={Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end"}
            opacity={dim(i) ? 0.3 : 1}
            className="fill-sub text-[11px]"
          >
            {STANCES[i]}
          </text>
        ))}
      {stage === 0 && (
        <>
          <text x={C} y={C - 4} textAnchor="middle" className="fill-text font-serif text-[22px] italic">
            Calm Fizz
          </text>
          <text x={C} y={C + 18} textAnchor="middle" className="fill-faint text-[11px]">
            $3.29 · beverage
          </text>
        </>
      )}
      {stage === 3 && (
        <>
          <text x={C} y={C - 6} textAnchor="middle" className="fill-faint text-[11px]">
            Launch to
          </text>
          <text x={C} y={C + 16} textAnchor="middle" className="fill-gold font-serif text-[17px] italic">
            Gen Z urban fitness
          </text>
        </>
      )}
    </svg>
  );
}
