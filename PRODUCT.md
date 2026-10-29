# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + Tailwind + Recharts in `frontend/`, shadcn/ui components, talking to the FastAPI backend in `backend/` through `NEXT_PUBLIC_API_URL`. Set by the project spec (`Proxy Panel — Technical Design.md` §F). Deploy target: Vercel (frontend), Railway (backend), Neon Postgres.

## Users

Pre-seed and seed founders of consumer products (D2C food and beverage, personal care, apparel, consumer apps), and small brand and marketing teams. They have a product concept and 2 or 3 candidate audiences, and no research budget. A second audience is hackathon judges (Qloo hackathon, which includes investors), who need to see real output in one click.

## Product Purpose

Proxy Panel is a pre-launch focus group: describe a product, and a panel of 6 personas built from measured Qloo taste data says which audience segment to launch to first, with which variant, at which price tier, and what will stop them buying. It gives a free run in about 90 seconds instead of a focus group that costs thousands of dollars and weeks. Success is a founder leaving with a launch segment, objections to test, and an interview script for real research.

## Positioning

The stance and price come from measured data, not from the LLM. Each persona's for-or-against stance is computed from its Qloo affinity lift to real comparable brands, and its price band comes from the price tiers of the brands it over-indexes on. The LLM only explains a stance it was handed. Every statement cites a Qloo "receipt", a validator checks every citation, and a grounding rate is shown. A "Without Qloo" comparison shows the generic LLM answer next to the grounded one.

## Operating Context

There are four screens in one run, and the user makes two decisions: (1) the brief (description, category, price, variant A and optional B, 1 to 3 segments from presets or free text); (2) confirming 3 to 6 comparable brands, with weight sliders; then (3) a live panel streamed to the page (progress steps, persona cards, two rounds, a moderator); then (4) a report led by the verdict. Founders use it at a desk on a laptop. The report should also read on a phone.

## Capabilities and Constraints

- Live product: every run calls real Qloo and Gemini. No mock or fixture data in production. A few example runs, produced by the live pipeline, back the "Try an example" button.
- Hackathon scale (MVP due 2026-10-30), with low traffic. Gemini is on the free tier and can return "high demand" errors, so error states must be honest and recoverable.
- Up to 3 segments, 2 variants, always 6 personas. Prices are in USD, US market only.
- It generates hypotheses about segments and objections. It does not forecast sales.
- Non-goals: accounts, payments, sales forecasting, testing visual assets, location selection.

## Brand Commitments

The name is Proxy Panel. The one-liner is "A focus group in 90 seconds whose panelists' opinions come from real taste data, not an LLM's imagination." The disclaimer always appears on reports: "These are hypotheses about segments and objections, not a sales forecast."

## Evidence on Hand

Real Qloo-backed runs produced by the live pipeline (see `backend/scripts/live_run.py`), and example briefs in `backend/app/presets.py`. There are no testimonials, customers, founder quotes or backtest results yet, so these must not be invented.

## Product Principles

1. Measured, not imagined: every number shown comes from Qloo data computed in code, and the interface must make that visible.
2. No claim without a source: data is one hover or focus away (receipts on every statement).
3. The verdict first: the report opens with the decision, and detail sits below.
4. Visible progress: a run always shows which step it is on, never a spinner alone.
5. Honest limits: state what the product does not do, and show flagged or unverified output as flagged.

## Accessibility & Inclusion

WCAG AA contrast. Colour is always backed by a text label (stance, flags, fit). Receipt chips work with focus as well as hover, and Esc closes them. The current progress step uses `aria-current`. The report works at 375 px.
