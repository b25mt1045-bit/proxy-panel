"use client";

import { ArrowRight, ChevronDown, Plus, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  ApiError,
  createRun,
  getExamples,
  getPresets,
  type Brief,
  type Category,
  type Example,
  type Preset,
} from "@/lib/api";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "beverage", label: "Beverage" },
  { value: "personal_care", label: "Personal care" },
  { value: "apparel", label: "Apparel" },
  { value: "app", label: "Consumer app" },
  { value: "other", label: "Other" },
];
// Same limits as backend/app/models.py; the server stays the authority.
const DESC_MIN = 20, DESC_MAX = 1000, NAME_MAX = 60, POS_MAX = 300, SEG_MIN = 3, SEG_MAX = 200, PRICE_MAX = 10000;

type VariantRow = { key: "A" | "B"; name: string; positioning: string; price: string };
type SegmentRow = { mode: "preset" | "text"; preset_id: string; text: string };
type Form = { description: string; category: Category | ""; price: string; variants: VariantRow[]; segments: SegmentRow[] };
type Errors = Record<string, string>; // keyed by the backend's field path: "description", "variants.0.name", "segments.1"

const EMPTY: Form = {
  description: "",
  category: "",
  price: "",
  variants: [{ key: "A", name: "", positioning: "", price: "" }],
  segments: [{ mode: "preset", preset_id: "", text: "" }],
};

const fieldId = (path: string) => `f-${path.replaceAll(".", "-")}`;

function priceError(raw: string, optional: boolean): string | null {
  if (!raw.trim()) return optional ? null : "Enter a price in USD.";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Enter a number, like 3.29.";
  if (n <= 0) return "Enter a price above $0.";
  if (n > PRICE_MAX) return "Keep the price at $10,000 or less.";
  return null;
}

function validate(f: Form): Errors {
  const e: Errors = {};
  const desc = f.description.trim().length;
  if (desc < DESC_MIN) e.description = `Describe the product in at least ${DESC_MIN} characters.`;
  else if (desc > DESC_MAX) e.description = "Keep the description under 1,000 characters.";
  if (!f.category) e.category = "Pick a category.";
  const p = priceError(f.price, false);
  if (p) e.price = p;
  f.variants.forEach((v, i) => {
    if (!v.name.trim()) e[`variants.${i}.name`] = `Name variant ${v.key}.`;
    else if (v.name.length > NAME_MAX) e[`variants.${i}.name`] = `Keep the name under ${NAME_MAX} characters.`;
    if (v.positioning.length > POS_MAX) e[`variants.${i}.positioning`] = `Keep it under ${POS_MAX} characters.`;
    const vp = priceError(v.price, true);
    if (vp) e[`variants.${i}.price`] = vp;
  });
  f.segments.forEach((s, i) => {
    if (s.mode === "preset" && !s.preset_id) e[`segments.${i}`] = "Pick a preset, or switch to Describe.";
    if (s.mode === "text" && s.text.trim().length < SEG_MIN) e[`segments.${i}`] = "Describe the segment in a few words.";
    if (s.mode === "text" && s.text.length > SEG_MAX) e[`segments.${i}`] = `Keep it under ${SEG_MAX} characters.`;
  });
  return e;
}

function toBrief(f: Form): Brief {
  return {
    description: f.description.trim(),
    category: f.category as Category,
    price: Number(f.price),
    variants: f.variants.map((v) => ({
      key: v.key,
      name: v.name.trim(),
      positioning: v.positioning.trim(),
      ...(v.price.trim() ? { price: Number(v.price) } : {}),
    })),
    segments: f.segments.map((s) => (s.mode === "preset" ? { preset_id: s.preset_id } : { text: s.text.trim() })),
  };
}

function fromBrief(b: Brief): Form {
  return {
    description: b.description,
    category: b.category,
    price: String(b.price),
    variants: b.variants.map((v) => ({
      key: v.key,
      name: v.name,
      positioning: v.positioning ?? "",
      price: v.price ? String(v.price) : "",
    })),
    segments: b.segments.map((s) =>
      s.preset_id ? { mode: "preset", preset_id: s.preset_id, text: "" } : { mode: "text", preset_id: "", text: s.text ?? "" },
    ),
  };
}

/** Errors are keyed by row index, so removing row i drops its errors and shifts later rows' errors up by one. */
function dropRow(e: Errors, list: "variants" | "segments", i: number): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(e)) {
    const m = new RegExp(`^${list}\\.(\\d+)(.*)$`).exec(k);
    const j = m ? Number(m[1]) : -1;
    if (!m || j < i) out[k] = v;
    else if (j > i) out[`${list}.${j - 1}${m[2]}`] = v;
  }
  return out;
}

const errorRef = (errors: Errors, path: string) => (errors[path] ? `${fieldId(path)}-error` : undefined);

/** "segments.0: Value error, give exactly one…" → ["segments.0", "Give exactly one…"]; null when it names no field. */
function parseServerError(message: string): [string, string] | null {
  const m = /^([a-z_]+(?:\.\d+(?:\.[a-z_]+)?)?): (.+)$/.exec(message);
  if (!m) return null;
  const text = m[2].replace(/^Value error, /, "");
  return [m[1], text.charAt(0).toUpperCase() + text.slice(1)];
}


const inputCls =
  "h-12 w-full rounded-xl border border-line-2 bg-raise px-4 text-[15px] text-text placeholder:text-faint " +
  "transition-[border-color,box-shadow] duration-300 hover:border-text focus:border-pop focus:outline-none " +
  "focus:ring-4 focus:ring-pop/10 aria-[invalid=true]:border-skeptic";

export function BriefForm() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [presetsFailed, setPresetsFailed] = useState(false);
  const [samples, setSamples] = useState<Brief[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);

  useEffect(() => {
    getPresets()
      .then((r) => {
        setPresets(r.presets);
        setSamples(r.sample_briefs);
      })
      .catch(() => {
        setPresetsFailed(true);
        setForm((f) => ({ ...f, segments: f.segments.map((s) => (s.preset_id ? s : { ...s, mode: "text" })) }));
      });
    getExamples()
      .then((r) => setExamples(r.examples))
      .catch(() => setExamples([]));
  }, []);

  // The hero's input hands its text over here (see HeroInput).
  useEffect(() => {
    const fill = (e: Event) => setForm((f) => ({ ...f, description: (e as CustomEvent<string>).detail }));
    window.addEventListener("brief:prefill", fill);
    return () => window.removeEventListener("brief:prefill", fill);
  }, []);

  const update = (patch: Partial<Form>, clear: string[] = []) => {
    setForm((f) => ({ ...f, ...patch }));
    if (clear.some((k) => errors[k])) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k))));
  };
  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    update(
      { variants: form.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) },
      Object.keys(patch).map((k) => `variants.${i}.${k}`),
    );
  const setSegment = (i: number, patch: Partial<SegmentRow>) =>
    update({ segments: form.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, [`segments.${i}`, `segments.${i}.text`]);

  function showErrors(e: Errors) {
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
  }

  async function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (submitting) return;
    setBanner(null);
    const e = validate(form);
    if (Object.keys(e).length) return showErrors(e);
    setSubmitting(true);
    try {
      const res = await createRun(toBrief(form));
      router.push(`/runs/${res.run_id}/confirm`);
    } catch (err) {
      setSubmitting(false);
      const apiErr = err instanceof ApiError ? err : new ApiError(0, "unknown", "Something went wrong. Try again.");
      const field = apiErr.status === 400 ? parseServerError(apiErr.message) : null;
      if (field) showErrors({ [field[0]]: field[1] });
      else setBanner(apiErr.message);
    }
  }

  const usedPresets = new Set(form.segments.map((s) => (s.mode === "preset" ? s.preset_id : "")).filter(Boolean));

  return (
    <section id="brief" aria-labelledby="brief-head" className="scroll-mt-16">
      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-5 pb-24 pt-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="lg:col-span-2">
          <p className="w-fit rounded-md bg-pop/10 px-2 py-0.5 text-sm font-medium text-pop">Your turn</p>
          <h2 id="brief-head" className="mt-1 font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.02em] text-text">
            Tell us about your product.
          </h2>
          <p id="brief-intro" className="mt-4 max-w-[56ch] text-lg leading-relaxed text-sub">
            Answer the four questions below, or tap a sample on the right to fill them in. Nothing runs until you confirm the
            comparable brands on the next screen.
          </p>
        </div>

        <form onSubmit={submit} noValidate aria-describedby="brief-intro" className="sticker rounded-3xl bg-raise px-6 sm:px-10">
          <Cue n={1} title="Product" hint="What it is and what makes it different." htmlFor={fieldId("description")}>
            <Field path="description" errors={errors}>
              <textarea
                id={fieldId("description")}
                rows={3}
                value={form.description}
                onChange={(e) => update({ description: e.target.value }, ["description"])}
                placeholder="A prebiotic sparkling soda with 5g sugar and adaptogens, sold in 12oz cans"
                aria-invalid={!!errors.description}
                aria-describedby={`${fieldId("description")}-count${errors.description ? ` ${fieldId("description")}-error` : ""}`}
                className={`${inputCls} h-auto resize-y py-3 leading-relaxed`}
              />
              <p
                id={`${fieldId("description")}-count`}
                className={`mt-2 text-right text-xs tabular-nums ${form.description.length > DESC_MAX ? "font-semibold text-skeptic" : "text-faint"}`}
              >
                {form.description.length.toLocaleString()} / 1,000
              </p>
            </Field>
          </Cue>

          <Cue n={2} title="Category and price" hint="Category sets which brands it's compared with. Price is USD, per unit or month.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field path="category" errors={errors}>
                <label htmlFor={fieldId("category")} className="mb-2 block text-xs text-sub">
                  Category
                </label>
                <SelectBox
                  id={fieldId("category")}
                  value={form.category}
                  invalid={!!errors.category}
                  onChange={(v) => update({ category: v as Category }, ["category"])}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </SelectBox>
              </Field>
              <Field path="price" errors={errors}>
                <label htmlFor={fieldId("price")} className="mb-2 block text-xs text-sub">
                  Price
                </label>
                <PriceInput
                  id={fieldId("price")}
                  value={form.price}
                  invalid={!!errors.price}
                  onChange={(v) => update({ price: v }, ["price"])}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </Cue>

          <Cue
            n={3}
            title="Variants"
            hint="Compare up to two names or positionings. A variant's price defaults to the product price."
            action={
              form.variants.length < 2 && (
                <AddButton onClick={() => update({ variants: [...form.variants, { key: "B", name: "", positioning: "", price: "" }] })}>
                  Add variant B
                </AddButton>
              )
            }
          >
            <div className="grid gap-5">
              {form.variants.map((v, i) => (
                <div key={v.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
                  <Badge>{v.key}</Badge>
                  <div className="grid gap-3">
                    <div className="flex gap-2">
                      <Field path={`variants.${i}.name`} errors={errors} className="flex-1">
                        <label htmlFor={fieldId(`variants.${i}.name`)} className="sr-only">
                          Variant {v.key} name
                        </label>
                        <input
                          id={fieldId(`variants.${i}.name`)}
                          value={v.name}
                          onChange={(e) => setVariant(i, { name: e.target.value })}
                          placeholder={v.key === "A" ? "Name, e.g. Calm Fizz" : "Name, e.g. Bolt"}
                          aria-invalid={!!errors[`variants.${i}.name`]}
                          aria-describedby={errorRef(errors, `variants.${i}.name`)}
                          className={inputCls}
                        />
                      </Field>
                      {v.key === "B" && (
                        <IconButton
                          label="Remove variant B"
                          onClick={() => {
                            update({ variants: form.variants.slice(0, 1) });
                            setErrors((e) => dropRow(e, "variants", 1));
                          }}
                        />
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                      <Field path={`variants.${i}.positioning`} errors={errors}>
                        <label htmlFor={fieldId(`variants.${i}.positioning`)} className="sr-only">
                          Variant {v.key} positioning (optional)
                        </label>
                        <input
                          id={fieldId(`variants.${i}.positioning`)}
                          value={v.positioning}
                          onChange={(e) => setVariant(i, { positioning: e.target.value })}
                          placeholder={v.key === "A" ? "Positioning, e.g. Relaxation (optional)" : "e.g. Focus (optional)"}
                          aria-invalid={!!errors[`variants.${i}.positioning`]}
                          aria-describedby={errorRef(errors, `variants.${i}.positioning`)}
                          className={inputCls}
                        />
                      </Field>
                      <Field path={`variants.${i}.price`} errors={errors}>
                        <label htmlFor={fieldId(`variants.${i}.price`)} className="sr-only">
                          Variant {v.key} price in USD (optional)
                        </label>
                        <PriceInput
                          id={fieldId(`variants.${i}.price`)}
                          value={v.price}
                          invalid={!!errors[`variants.${i}.price`]}
                          onChange={(val) => setVariant(i, { price: val })}
                          placeholder={form.price || "Same"}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Cue>

          <Cue
            n={4}
            title="Segments"
            meta={`${form.segments.length} of 3`}
            hint="Who might buy it. Pick a preset or describe your own; each gets its own panelists."
            action={
              form.segments.length < 3 && (
                <AddButton
                  onClick={() =>
                    update({ segments: [...form.segments, { mode: presetsFailed ? "text" : "preset", preset_id: "", text: "" }] })
                  }
                >
                  Add segment
                </AddButton>
              )
            }
          >
            {presetsFailed && (
              <p className="mb-4 text-sm text-sub">Presets didn&apos;t load. Describe each segment in your own words instead.</p>
            )}
            <div className="grid gap-3">
              {form.segments.map((s, i) => (
                <fieldset key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
                  <legend className="sr-only">Segment {i + 1}</legend>
                  <Badge>{i + 1}</Badge>
                  <Field path={`segments.${i}`} errors={errors}>
                    <div className="flex flex-wrap gap-2">
                      <ModeSwitch
                        name={`seg-mode-${i}`}
                        value={s.mode}
                        disabledPreset={presetsFailed}
                        onChange={(mode) => setSegment(i, { mode })}
                      />
                      <div className="min-w-[12rem] flex-1">
                        {s.mode === "preset" ? (
                          <SelectBox
                            id={fieldId(`segments.${i}`)}
                            label={`Segment ${i + 1} preset`}
                            value={s.preset_id}
                            invalid={!!errors[`segments.${i}`]}
                            onChange={(v) => setSegment(i, { preset_id: v })}
                          >
                            <option value="" disabled>
                              {presets ? "Choose a preset…" : "Loading presets…"}
                            </option>
                            {presets?.map((p) => (
                              <option key={p.id} value={p.id} disabled={usedPresets.has(p.id) && s.preset_id !== p.id}>
                                {p.label}
                              </option>
                            ))}
                          </SelectBox>
                        ) : (
                          <>
                            <label htmlFor={fieldId(`segments.${i}`)} className="sr-only">
                              Segment {i + 1} description
                            </label>
                            <input
                              id={fieldId(`segments.${i}`)}
                              value={s.text}
                              onChange={(e) => setSegment(i, { text: e.target.value })}
                              placeholder="e.g. remote tech workers in their 30s"
                              aria-invalid={!!errors[`segments.${i}`]}
                              aria-describedby={errorRef(errors, `segments.${i}`)}
                              maxLength={SEG_MAX + 20}
                              className={inputCls}
                            />
                          </>
                        )}
                      </div>
                      {form.segments.length > 1 && (
                        <IconButton
                          label={`Remove segment ${i + 1}`}
                          onClick={() => {
                            update({ segments: form.segments.filter((_, j) => j !== i) });
                            setErrors((e) => dropRow(e, "segments", i));
                          }}
                        />
                      )}
                    </div>
                  </Field>
                </fieldset>
              ))}
            </div>
          </Cue>

          <div className="py-10">
            {/* Shown next to the button that caused it, so it can't land off-screen. */}
            {banner && (
              <div role="alert" className="mb-6 flex gap-3 rounded-xl border border-skeptic/50 bg-skeptic/5 px-4 py-3">
                <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-skeptic" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-text">{banner}</p>
                  <p className="mt-1 text-sm text-sub">
                    Your brief is still here.{" "}
                    <button type="button" onClick={() => submit()} className="text-pop underline">
                      Try again
                    </button>
                    {examples.length > 0 && " or open an example run."}
                  </p>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="group relative flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-text text-base font-medium text-ink shadow-lg shadow-text/15 hover:bg-pop transition-transform duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-progress disabled:bg-raise disabled:text-sub"
            >
              {submitting && (
                <span aria-hidden className="absolute inset-0 origin-left animate-fill bg-pop/15 motion-reduce:hidden" />
              )}
              <span className="relative">{submitting ? "Finding comparables…" : "Find comparables"}</span>
              {!submitting && (
                <ArrowRight
                  aria-hidden
                  className="relative size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              )}
            </button>
            <p role="status" className="mt-4 text-center text-[13px] text-faint">
              {submitting
                ? "An AI suggests competitor brands, then each one is checked against Qloo. This takes 10 to 20 seconds."
                : "Next, you confirm 3 to 6 comparable brands before the panel starts."}
            </p>
          </div>
        </form>

        <aside className="grid content-start gap-12 lg:pt-1">
          {samples.length > 0 && (
            <section aria-labelledby="samples-head">
              <h3 id="samples-head" className="text-sm text-sub">
                Start from a sample
              </h3>
              <ul className="mt-4 border-t border-line">
                {samples.map((b) => (
                  <li key={b.description} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(fromBrief(b));
                        setErrors({});
                        setBanner(null);
                      }}
                      className="group w-full py-4 text-left"
                    >
                      <span className="flex items-center justify-between text-[15px] text-text transition-colors group-hover:text-pop">
                        {b.variants[0].name}
                        <ArrowRight aria-hidden className="size-3.5 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-faint">{b.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">Fills the form. Nothing runs until you submit.</p>
            </section>
          )}
          {examples.length > 0 && (
            <section aria-labelledby="examples-head">
              <h3 id="examples-head" className="text-sm text-sub">
                Try an example
              </h3>
              <ul className="mt-4 border-t border-line">
                {examples.map((x) => (
                  <li key={x.run_id} className="border-b border-line">
                    <Link href={`/runs/${x.run_id}/report`} className="group block py-4">
                      <span className="block text-[15px] text-text transition-colors group-hover:text-pop">{x.title}</span>
                      {x.verdict_sentence && <span className="mt-1 block text-[13px] text-faint">{x.verdict_sentence}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Measured />
        </aside>
      </div>
    </section>
  );
}

function Measured() {
  const rows: [string, string][] = [
    ["Stance", "Qloo affinity to the comparable brands"],
    ["Price band", "Price tiers of the brands they over-index on"],
    ["Every line", "Cites Qloo data, checked before you see it"],
  ];
  return (
    <section aria-labelledby="measured-head">
      <h3 id="measured-head" className="text-sm text-sub">
        Computed from data, not the AI
      </h3>
      <dl className="mt-4 border-t border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="border-b border-line py-3.5">
            <dt className="text-[15px] text-text">{k}</dt>
            <dd className="mt-1 text-[13px] leading-snug text-faint">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Stances">
        <li className="flex items-center gap-1.5 text-enthusiast">
          <span aria-hidden className="size-1.5 rounded-full bg-enthusiast" />
          Enthusiast
        </li>
        <li className="flex items-center gap-1.5 text-conditional">
          <span aria-hidden className="size-1.5 rounded-full bg-conditional" />
          Conditional
        </li>
        <li className="flex items-center gap-1.5 text-skeptic">
          <span aria-hidden className="size-1.5 rounded-full bg-skeptic" />
          Skeptic
        </li>
      </ul>
    </section>
  );
}

const CUE_BG = ["bg-sky", "bg-sun", "bg-mint", "bg-peach"];

/** One step of the brief: its label and hint on the left, controls on the right. */
function Cue({
  n,
  title,
  hint,
  meta,
  htmlFor,
  action,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  meta?: string;
  htmlFor?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const Title = htmlFor ? "label" : "h3";
  return (
    <section aria-label={title} className="grid gap-x-10 gap-y-5 border-b border-line py-10 last:border-b-0 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <span
          aria-hidden
          className={`flex size-10 items-center justify-center rounded-full border border-line-2 font-serif text-lg font-bold ${CUE_BG[(n - 1) % CUE_BG.length]}`}
        >
          {n}
        </span>
        <Title htmlFor={htmlFor} className="mt-3 block font-serif text-2xl text-text">
          {title}
          {meta && <span className="ml-2 text-sm text-faint">{meta}</span>}
        </Title>
        <p className="mt-1.5 text-sm leading-relaxed text-sub">{hint}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ path, errors, className, children }: { path: string; errors: Errors; className?: string; children: ReactNode }) {
  const msg = errors[path];
  return (
    <div className={className}>
      {children}
      {msg && (
        <p id={`${fieldId(path)}-error`} className="mt-2 flex items-center gap-1.5 text-[13px] text-skeptic">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
          {msg}
        </p>
      )}
    </div>
  );
}

function SelectBox({
  id,
  label,
  value,
  invalid,
  onChange,
  children,
}: {
  id: string;
  label?: string;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={`${inputCls} appearance-none pr-10 ${value ? "" : "text-faint"}`}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-sub" strokeWidth={1.75} />
    </div>
  );
}

function PriceInput({
  id,
  value,
  invalid,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sub">
        $
      </span>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder={placeholder}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={`${inputCls} pl-8 text-right tabular-nums`}
      />
    </div>
  );
}

function ModeSwitch({
  name,
  value,
  disabledPreset,
  onChange,
}: {
  name: string;
  value: SegmentRow["mode"];
  disabledPreset: boolean;
  onChange: (m: SegmentRow["mode"]) => void;
}) {
  const opts: [SegmentRow["mode"], string][] = [
    ["preset", "Preset"],
    ["text", "Describe"],
  ];
  return (
    <div role="radiogroup" aria-label="Segment type" className="flex h-12 rounded-full border border-line-2 bg-raise p-1">
      {opts.map(([m, label]) => (
        <label
          key={m}
          className={`flex cursor-pointer items-center rounded-full px-4 text-[13px] transition-colors duration-300 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pop ${
            value === m ? "bg-text text-ink" : "text-sub hover:text-text"
          } ${m === "preset" && disabledPreset ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={m}
            checked={value === m}
            disabled={m === "preset" && disabledPreset}
            onChange={() => onChange(m)}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="flex h-12 items-center text-sm tabular-nums text-faint">
      {children}
    </span>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] text-text transition-colors duration-300 hover:border-pop hover:text-pop"
    >
      <Plus aria-hidden className="size-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line-2 text-sub transition-colors duration-300 hover:border-skeptic hover:text-skeptic"
    >
      <X aria-hidden className="size-4" strokeWidth={1.75} />
    </button>
  );
}
