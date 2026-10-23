"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, Brief, Category, createRun, Presets } from "@/lib/api";
import { btn, field, Label, Notice } from "./ui";

const CATEGORIES: [Category, string][] = [
  ["beverage", "Beverage"], ["personal_care", "Personal care"], ["apparel", "Apparel"], ["app", "Consumer app"], ["other", "Other"],
];

type Row = { mode: "preset" | "text"; preset_id: string; text: string };
type Form = { description: string; category: Category; price: string; aName: string; aPos: string;
  hasB: boolean; bName: string; bPos: string; bPrice: string; rows: Row[] };

const blank = (presets: Presets["presets"]): Form => ({
  description: "", category: "beverage", price: "", aName: "", aPos: "", hasB: false, bName: "", bPos: "", bPrice: "",
  rows: [{ mode: "preset", preset_id: presets[0]?.id ?? "", text: "" }],
});

function fromBrief(b: Brief): Form {
  const [a, v] = b.variants;
  return {
    description: b.description, category: b.category, price: String(b.price), aName: a.name, aPos: a.positioning ?? "",
    hasB: !!v, bName: v?.name ?? "", bPos: v?.positioning ?? "", bPrice: v?.price ? String(v.price) : "",
    rows: b.segments.map((s) => s.preset_id
      ? { mode: "preset", preset_id: s.preset_id, text: "" } : { mode: "text", preset_id: "", text: s.text ?? "" }),
  };
}

// Same limits as the backend's Brief model (design §3); the server stays the authority.
function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const n = f.description.trim().length;
  if (n < 20 || n > 1000) e.description = "Describe the product in 20 to 1,000 characters.";
  const p = Number(f.price);
  if (!(p > 0 && p <= 10000)) e.price = "Enter a price above $0 and up to $10,000.";
  if (!f.aName.trim()) e.aName = "Name the product.";
  if (f.hasB && !f.bName.trim()) e.bName = "Name variant B, or remove it.";
  if (f.hasB && f.bPrice && !(Number(f.bPrice) > 0 && Number(f.bPrice) <= 10000)) e.bPrice = "Leave blank to use the main price.";
  f.rows.forEach((r, i) => {
    if (r.mode === "text" && (r.text.trim().length < 3 || r.text.trim().length > 200)) e[`seg${i}`] = "Describe the segment in 3 to 200 characters.";
  });
  return e;
}

function toBrief(f: Form): Brief {
  return {
    description: f.description.trim(), category: f.category, price: Number(f.price),
    variants: [
      { key: "A", name: f.aName.trim(), positioning: f.aPos.trim() },
      ...(f.hasB ? [{ key: "B" as const, name: f.bName.trim(), positioning: f.bPos.trim(), price: f.bPrice ? Number(f.bPrice) : null }] : []),
    ],
    segments: f.rows.map((r) => (r.mode === "preset" ? { preset_id: r.preset_id } : { text: r.text.trim() })),
  };
}

export default function BriefForm({ presets, example }: { presets: Presets["presets"]; example: Brief | null }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => (example ? fromBrief(example) : blank(presets)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(example);
  if (example !== seen) { setSeen(example); if (example) { setF(fromBrief(example)); setErrors({}); } }

  const up = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));
  const upRow = (i: number, patch: Partial<Row>) => up({ rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const err = (k: string) => errors[k] && <p id={`${k}-err`} className="mt-1.5 text-[13px] text-negative">{errors[k]}</p>;
  const aria = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-err` : undefined });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    setBanner(null);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const r = await createRun(toBrief(f));
      router.push(`/runs/${r.run_id}/confirm`);
    } catch (x) {
      const a = x as ApiError;
      setBanner(a.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {banner && <Notice tone="negative">{banner}</Notice>}

      <div>
        <Label htmlFor="description" hint={`${f.description.trim().length} / 1,000`}>What are you launching?</Label>
        <textarea id="description" rows={3} maxLength={1000} value={f.description} {...aria("description")}
                  onChange={(e) => up({ description: e.target.value })}
                  placeholder="A prebiotic sparkling soda with 5g sugar and adaptogens, sold in 12oz cans"
                  className={`${field} h-auto py-2.5 leading-5`} />
        {err("description")}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <select id="category" value={f.category} onChange={(e) => up({ category: e.target.value as Category })} className={field}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="price">Price (USD)</Label>
          <input id="price" inputMode="decimal" value={f.price} {...aria("price")} placeholder="3.29"
                 onChange={(e) => up({ price: e.target.value })} className={`${field} num`} />
          {err("price")}
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-medium">Product name and positioning</legend>
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <div>
            <input aria-label="Variant A name" value={f.aName} {...aria("aName")} maxLength={60} placeholder="Calm Fizz"
                   onChange={(e) => up({ aName: e.target.value })} className={field} />
            {err("aName")}
          </div>
          <input aria-label="Variant A positioning" value={f.aPos} maxLength={300} placeholder="Positioning, optional"
                 onChange={(e) => up({ aPos: e.target.value })} className={field} />
        </div>
        {f.hasB ? (
          <div className="grid grid-cols-[1fr_1fr_0.6fr_auto] items-start gap-3">
            <div>
              <input aria-label="Variant B name" value={f.bName} {...aria("bName")} maxLength={60} placeholder="Variant B name"
                     onChange={(e) => up({ bName: e.target.value })} className={field} />
              {err("bName")}
            </div>
            <input aria-label="Variant B positioning" value={f.bPos} maxLength={300} placeholder="Positioning"
                   onChange={(e) => up({ bPos: e.target.value })} className={field} />
            <div>
              <input aria-label="Variant B price" inputMode="decimal" value={f.bPrice} {...aria("bPrice")} placeholder="Same price"
                     onChange={(e) => up({ bPrice: e.target.value })} className={`${field} num`} />
              {err("bPrice")}
            </div>
            <button type="button" className={`${btn.text} h-10 text-muted`} onClick={() => up({ hasB: false })}>Remove</button>
          </div>
        ) : (
          <button type="button" className={btn.text} onClick={() => up({ hasB: true })}>+ Test a variant B</button>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-medium">Who should the panel represent? <span className="font-normal text-muted">Up to 3 segments</span></legend>
        {f.rows.map((r, i) => (
          <div key={i}>
            <div className="grid grid-cols-[132px_1fr_auto] items-center gap-3">
              <select aria-label={`Segment ${i + 1} type`} value={r.mode} className={field}
                      onChange={(e) => upRow(i, { mode: e.target.value as Row["mode"], preset_id: r.preset_id || presets[0]?.id || "" })}>
                <option value="preset">Preset</option>
                <option value="text">Describe</option>
              </select>
              {r.mode === "preset" ? (
                <select aria-label={`Segment ${i + 1}`} value={r.preset_id} onChange={(e) => upRow(i, { preset_id: e.target.value })} className={field}>
                  {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              ) : (
                <input aria-label={`Segment ${i + 1}`} value={r.text} maxLength={200} {...aria(`seg${i}`)}
                       placeholder="remote tech workers in their 30s" onChange={(e) => upRow(i, { text: e.target.value })} className={field} />
              )}
              <button type="button" disabled={f.rows.length === 1} className={`${btn.text} text-muted disabled:invisible`}
                      onClick={() => up({ rows: f.rows.filter((_, j) => j !== i) })}>Remove</button>
            </div>
            {err(`seg${i}`)}
          </div>
        ))}
        {f.rows.length < 3 && (
          <button type="button" className={btn.text}
                  onClick={() => up({ rows: [...f.rows, { mode: "text", preset_id: presets[0]?.id ?? "", text: "" }] })}>
            + Add a segment
          </button>
        )}
      </fieldset>

      <div className="flex items-center gap-4 pt-2">
        <button type="submit" disabled={busy} className={btn.primary}>
          {busy ? "Finding comparable brands…" : "Find comparable brands"}
        </button>
        <span className="text-[13px] text-muted">Next you confirm the brands the panel compares you to.</span>
      </div>
    </form>
  );
}
