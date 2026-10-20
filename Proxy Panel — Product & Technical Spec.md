# Proxy Panel — Product & Technical Spec

Oct 20, 2026 · @Yajat Gupta

## Overview

Proxy Panel is a pre-launch test for consumer products: describe a product, and a panel of personas built from measured Qloo taste data tells you which audience to launch to first, what they will object to, and what price band they sit in. Every claim cites the Qloo data behind it.

**One-liner:** A focus group in 90 seconds whose panelists' opinions come from real taste data, not an LLM's imagination.

**Problem.** Early-stage founders launch to the wrong audience, at the wrong price, with the wrong name. A real focus group costs thousands of dollars and weeks. Asking ChatGPT "would people like this?" returns flattering, generic, culturally average answers. That is the exact "culturally blind agent" problem the hackathon names.

**Target user.** Pre-seed and seed founders of consumer products (D2C food and beverage, personal care, apparel, consumer apps), plus small brand and marketing teams. They have a concept and 2 to 3 candidate audiences, and no research budget.

**The decision it answers.** "Which audience segment do I launch to first, with which variant, at which price tier, and what will stop them buying?"

**Why it needs Qloo.** Three outputs come from measured data, not the LLM:

1. **Who the personas are**: each persona's taste fingerprint (brands, music, films, podcasts, places they over-index on) comes from Qloo.
2. **Whether each persona leans for or against**: computed from that persona's measured affinity to real comparable brands, before any LLM speaks.
3. **Price band**: inferred from the price tiers of the brands each persona actually over-indexes on.

The LLM only explains a stance it was handed. Switch Qloo off and the product visibly degrades, which the demo shows side by side.

## Competitive position

We beat Quorum by answering a different question with more measured data: which audience, which variant and which price, for a product, instead of go or no-go for a venue on one street.

[Quorum](https://github.com/AkshayJohn03/quorum-app) is the closest rival entry and it is good. It is deployed, MIT licensed, and every panelist statement must cite a Qloo "receipt", with a grounding rate shown on each report. **Receipts and a grounding rate are now table stakes, not a differentiator.** We match them and then go further.

| Dimension | Quorum | Proxy Panel |
| --- | --- | --- |
| Domain | Hospitality concepts on a chosen street | Consumer products and brands, no location required |
| Core question | GO / PIVOT / NO-GO for one site | Which segment first, which variant, which price tier |
| Audiences per run | One (the street's locals) | Up to 3 segments compared side by side |
| Variants | One concept | Up to 3 variants (names, positionings, price points) |
| Stance source | Concept-street affinity lift | Measured affinity to real comparable brands, per persona |
| Price | Not covered | Price band per persona from the tiers of brands they over-index on |
| Proof Qloo matters | Grounding rate | Grounding rate + live "without Qloo" comparison + leave-one-out backtest |

### Closing the "LLMs are still speaking" gap

The honest critique of any synthetic panel is that the LLM decides how a persona reacts. Proxy Panel removes that decision from the LLM in three steps:

1. **Stance is computed, not generated.** Each persona gets a stance score from its measured affinity to the concept's comparable brands (section Agent design has the formula). The LLM receives "you lean against, score 0.31, because of receipts R4 and R7" and may only explain it.
2. **Price is computed, not generated.** Each persona's price band is the affinity-weighted tier of the brands it over-indexes on. The LLM may not name a price outside that band.
3. **Every sentence is checked.** A validator rejects statements that cite no receipt, cite a receipt the persona does not hold, or contradict the computed stance. Rejected lines are regenerated once, then shown flagged.

We say the limit plainly in the product: this generates hypotheses about segments and objections, it does not predict sales. The report ends with who to interview to confirm them.

## Scope

The MVP is one complete run: a brief in, a live panel, and a report out, for up to 3 segments and 2 variants. Everything else is stretch.

### MVP (must ship by Oct 30)

- [ ] Brief form: product description, category, price point, 1 to 2 variants, 1 to 3 target segments
- [ ] Comparable-brand resolver: suggests 3 to 6 real brands from Qloo, user confirms or edits them
- [ ] Audience fingerprints from Qloo for each segment (brands, artists, films or TV, podcasts, demographics)
- [ ] 6 personas (2 per segment, or 6 for a single segment), each with a fingerprint, computed stance and price band
- [ ] Live panel: 2 rounds (first reaction, then moderator probes on disagreements), streamed to the page
- [ ] Receipts on every statement, hover to see the Qloo data, grounding rate in the header
- [ ] Report: segment ranking, top objections, price bands, variant comparison, interview script
- [ ] "Without Qloo" comparison for the same brief, side by side
- [ ] Hosted, public repo, MIT license, 3 cached example runs for judges

### Stretch (only if MVP is done by Oct 27)

- Leave-one-out backtest page showing results on 5 real brands (strongly recommended, see Validation)
- Shareable report link and PDF export
- Market toggle (US, India, UK) through Qloo location signals, if coverage holds
- Ask-the-panel: the user types a follow-up question to one persona
- MCP server exposing the panel as a tool for other agents (covers the "connect Qloo to an existing agent" track too)

### Non-goals

- Sales or demand forecasting in numbers of units
- User accounts, payments, teams
- Testing visual assets such as logos or ad images
- Location or site selection (Quorum's ground; stay off it)

## User flow and screens

A run takes four screens and about 90 seconds, and the user makes only two decisions: the brief and the comparable brands.

1. **Brief.** The user fills in product description, category, price, and optional variant B. They pick 1 to 3 segments from presets ("Gen Z urban fitness", "health-conscious parents 35 to 55") or describe their own. A "Try an example" button loads one of 3 cached runs so judges see output in one click.
2. **Confirm comparables.** The agent proposes 3 to 6 real brands as chips (e.g. for a functional soda: Olipop, Poppi, Liquid Death), each with a similarity weight slider. The user removes, adds or reweights them. This step is what makes the stance math trustworthy, so it stays visible, not hidden.
3. **Live panel.** A chat-style transcript streams in: each persona card shows name, segment, a mini taste fingerprint (top 3 brands, artists, shows) and a stance meter. Every statement carries receipt chips, and hovering one shows the Qloo entity and its affinity. Round 2 opens with the moderator naming the disagreement it is probing.
4. **Report.** A dashboard with the segment verdict on top, then objections, price bands, variant comparison and the interview script. A toggle at the top flips to "Without Qloo" for the same brief, showing the generic LLM answer next to the grounded one.

**Design principles**

- The verdict is on the first screen of the report; detail sits below.
- Data is always one hover away: no claim without a visible source.
- Progress is visible during the run ("Resolving comparables… Building 6 personas… Round 1…"), never a spinner alone.
- Mobile works for reading the report; the brief can be desktop-first.

## System architecture

A run flows top to bottom through five backend stages, and only the highlighted scoring engine decides stance and price.

&#91;embedded content: system architecture · web app, 5 backend stages, 3 services\]

The orchestrator, panel runner and analyst all call the LLM; only the Qloo client talks to Qloo, so every Qloo response passes through one cache.

## Qloo integration

A run makes about 20 to 30 Qloo calls through two endpoints, every response is cached, and nothing reaches the LLM that did not first come from Qloo or the user.

The endpoint shapes below are taken from working hackathon repos ([fanroute](https://github.com/Akhil-1527/fanroute), [Quorum](https://github.com/AkshayJohn03/quorum-app)). Confirm each one with the real key on day 1; items marked **verify** are assumptions.

| Call | Purpose in Proxy Panel | Key parameters |
| --- | --- | --- |
| `GET /search` | Resolve comparable brands and segment seed entities to Qloo IDs | `query`, `types=urn:entity:brand` (also artist, movie, podcast), `take` |
| `GET /v2/insights`, `filter.type=urn:entity:brand` | Brands a segment over-indexes on; candidate comparables | `signal.interests.entities`, `take` |
| `GET /v2/insights`, `filter.type=urn:entity:artist`, `movie`, `tv_show`, `podcast` | Cross-domain taste fingerprint for each persona | `signal.interests.entities`, `take=5` |
| `GET /v2/insights`, `filter.type=urn:demographics` | Age and gender skew of a segment or a comparable brand's audience | `signal.interests.entities` |
| `GET /v2/insights` with demographic signals | Steer a segment by age or gender bucket | `signal.demographics.age`, `signal.demographics.gender` (**verify** names and buckets) |
| `GET /v2/insights` with location | Optional market toggle | `signal.location` (**verify** coverage outside the US) |

### How a segment becomes Qloo signals

1. The LLM turns the segment text into 3 to 5 seed entities (e.g. "Gen Z urban fitness" → a fitness brand, an athleisure brand, a fitness podcast) plus a demographic bucket.
2. Each seed is resolved with `/search`. Seeds that do not resolve are dropped and shown to the user.
3. The resolved seeds become `signal.interests.entities` for every insights call for that segment.

### Affinity, lift and the 0.9 cap

Quorum reports that raw affinities cap near 0.9, so raw scores separate poorly. We use **lift**: a persona's affinity to an entity minus the same entity's affinity under a neutral baseline signal (a broad, generic seed set). Lift is what drives stance and price.

### Quota, latency and caching

- The hackathon key has a monthly quota (fanroute notes this). Cache every response in the database by a hash of the URL and parameters, with no expiry during the hackathon.
- Space requests at least 220 ms apart; on HTTP 429 wait 1 s and retry once; on a 5xx retry once, then continue with partial data and say so in the report.
- Run independent calls in parallel within that spacing, using an async client.
- Pre-warm the cache for the 3 example runs and the 5 backtest brands, so judges' clicks cost no quota.
- Keep a `QLOO_MOCK=1` mode with recorded fixtures so frontend work never burns quota.

## Agent design

Five roles share one rule: code computes, the LLM explains. Numbers (stance, price band, segment ranking) are calculated from Qloo data in Python; LLM calls turn text into Qloo signals, and data into speech.

### Roles

| Role | Type | Input | Output |
| --- | --- | --- | --- |
| Orchestrator | Tool-calling LLM agent | The brief | A completed run; decides retries, e.g. replaces seeds that fail to resolve |
| Persona builder | Code + 1 LLM call | Segment seeds, Qloo fingerprints | 6 personas: fingerprint, stance score, price band, receipts, a name and one-line bio |
| Panelist (×6) | LLM, one call per round | Own persona card + the concept | 60 to 100 words, each claim citing receipt IDs |
| Moderator | LLM | Round 1 transcript + stance scores | 1 to 2 probing questions aimed at the widest disagreement |
| Analyst | Code + 1 LLM call | All data and transcripts | The report; numbers from code, wording from the LLM |

**Orchestrator tools:** `qloo_search`, `qloo_insights`, `propose_comparables`, `build_personas`, `run_round`, `validate_statements`, `write_report`. The pipeline order is fixed in code; the orchestrator chooses arguments and handles failures. That keeps runs reliable while staying genuinely agentic.

### Building 6 distinct personas

Within a segment, each persona uses a different subset of the segment's seeds plus a different age bucket, so their fingerprints differ for a real reason. Each fingerprint holds the top 5 entities across brands, artists, films or TV and podcasts, each with its lift. Every entity becomes a **receipt** with an ID (R1, R2…), the entity name, type and lift.

### Stance score

For persona p and the confirmed comparables c with user weights w:

```latex
\text{stance}_p = \frac{\sum_c w_c \cdot \text{lift}(p, c)}{\sum_c w_c}
```

Scores are min-max scaled across the run's personas, then mapped: top third **enthusiast**, middle **conditional**, bottom **skeptic**. If every persona's raw lift is negative, all are labelled skeptic regardless of rank, so a bad concept cannot produce fake enthusiasts.

**Verify on day 1:** whether `/v2/insights` can score a named brand under given signals. If it only returns top-N lists, request `take=50` and treat absence from the list as low affinity.

### Price band

Each brand in a persona's fingerprint gets a price tier from 1 (budget) to 4 (premium), labelled once by the LLM, cached and editable by the user. The persona's band is the lift-weighted mean tier plus or minus one standard deviation. The concept's tier comes from its price against the comparables' prices. **Price fit** = the concept tier falls inside the band.

### Panelist prompt (template)

```
You are {name}, {bio}. Your measured tastes (cite by ID):
{R1: Brand X, lift +0.12} {R2: Artist Y, lift +0.09} ...
Your stance on this product is {stance_label} (score {s}). Your price band is tier {lo} to {hi}; the product is tier {t}.
React to: {concept}.
Rules: 60-100 words. Every claim cites at least one receipt ID in [brackets]. Do not change your stance. Do not name a price outside your band. Do not invent tastes not listed.
```

### Moderator logic

Code picks the two personas with the largest stance gap who cite receipts of the same type (both brand, both media). The moderator LLM writes 1 to 2 questions about that gap; only those two personas answer in round 2.

### Validator rules

Every statement is checked in code after generation:

1. At least one receipt ID is cited.
2. Every cited ID belongs to that persona.
3. Stance words match the label (a sentiment check by a small LLM call).
4. No price outside the band.

A failing statement is regenerated once with the error named; if it fails again it is shown with a flag. **Grounding rate** = passing statements / all statements, shown in the report header.

## Data model and backend API

Six tables and seven endpoints cover the whole product; a run is created, confirmed once, then streamed to completion.

### Tables

| Table | Key fields |
| --- | --- |
| `runs` | id, created\_at, status (draft, confirming, running, done, failed), brief JSON, mode (grounded, ungrounded), is\_example |
| `comparables` | run\_id, qloo\_id, name, weight, price, price\_tier |
| `personas` | id, run\_id, segment, name, bio, fingerprint JSON, stance\_score, stance\_label, price\_lo, price\_hi |
| `receipts` | id (R1…), persona\_id, qloo\_id, entity\_name, entity\_type, lift |
| `statements` | id, run\_id, persona\_id, round, text, receipt\_ids, passed, flags |
| `qloo_cache` | key (hash of path and params), response JSON, fetched\_at |

The report is computed from these tables on request and cached as JSON on the run, so no separate table is needed.

### Endpoints (FastAPI)

| Method and path | Does |
| --- | --- |
| `POST /runs` | Create a run from a brief; returns run id and proposed comparables |
| `PUT /runs/{id}/comparables` | User confirms or edits comparables and weights; starts the run |
| `GET /runs/{id}/stream` | Server-sent events: progress steps, personas, each statement as it passes validation |
| `GET /runs/{id}` | Full run state, for reloads and share links |
| `GET /runs/{id}/report` | The computed report JSON |
| `POST /runs/{id}/ungrounded` | Runs the same brief with Qloo disabled, for the side-by-side |
| `GET /examples` | The 3 cached example runs and the backtest results |

**Guards for public judging:** a limit of 5 new runs per IP per day, a global daily LLM spend cap that switches new runs to examples-only, and the cached examples always available.

## Report

The report leads with one sentence, "Launch to segment X with variant Y at tier Z", and every section below it backs that sentence with data.

| Section | Content | Computed by |
| --- | --- | --- |
| Verdict | Recommended segment, variant and price tier, plus a confidence label (strong, mixed, weak) | Code: mean stance per segment, spread between personas |
| Segment ranking | Each segment's mean stance, price fit, and top 3 over-indexed comparables | Code; bar chart |
| Top objections | 3 to 5 objections, each with the personas who raised it and the receipts behind it | LLM clusters statements; receipts carried through |
| Price bands | Each persona's band against the concept's tier | Code; range chart |
| Variant comparison | Stance per segment for variant A vs B | Code |
| What the data says they love | Cross-domain taste of the winning segment: brands, artists, shows, podcasts | Qloo data directly; useful for marketing and partnerships |
| What would change the verdict | The single comparable or segment whose weight flips the result | Code: sensitivity test on weights |
| Validate with real people | Who to recruit (segment description plus 2 to 3 taste markers) and 5 interview questions aimed at the top objections | LLM from the objections |
| Grounding | Grounding rate, number of Qloo calls, and a link to every receipt | Code |

The "without Qloo" view uses the same layout, so the gaps show: no receipts, no price bands, and personas that sound alike.

## Validation

Three tests prove the panel is grounded, and the leave-one-out backtest is the one no rival entry we found has: Quorum's repo reports only offline tests with mock data.

### 1. Leave-one-out backtest (the headline proof)

Pick 5 real consumer brands Qloo knows well. For each one:

1. Describe it as if it were a new product, without its name.
2. Choose comparables that exclude the brand itself.
3. Run the panel across 3 candidate segments.
4. Compare the panel's top segment with the brand's actual audience from Qloo's `urn:demographics` and brand insights.

**Success:** the panel's top segment matches the brand's real audience for at least 4 of 5 brands. Publish all 5 results, including misses, on an "Evidence" page. Honest misses read as rigour; hidden ones read as cherry-picking.

Be precise about what this proves: the panel agrees with Qloo's own data on known brands, using only neighbouring brands. It shows internal consistency, not real-world sales accuracy.

### 2. Grounded vs ungrounded (shown live)

Run the same 3 example briefs with Qloo on and off and measure:

| Metric | How measured | Expected direction |
| --- | --- | --- |
| Grounding rate | Validator pass rate | High grounded; near zero ungrounded |
| Persona distinctness | Mean pairwise embedding distance between personas' statements | Higher grounded |
| Specificity | Named real entities per statement | Higher grounded |
| Verdict stability | Same top segment across 3 reruns | More stable grounded |

Fill in the real numbers after day 7; don't promise them in the submission before measuring.

### 3. Real founders

Run the panel for 3 real founders (IIT Jodhpur's incubator, student startups, or D2C founders on LinkedIn). Ask each one: did it name an audience or objection you had not considered, and would you use it before launch? Quote them, with permission, in the submission and the video.

## Tech stack, deployment and cost

Python FastAPI backend plus a Next.js frontend: the backend plays to the Python you know and is the backend practice you want, and the frontend gets the polish that a quarter of the score rewards.

| Layer | Choice | Why |
| --- | --- | --- |
| Backend | Python 3.12, FastAPI, `httpx` async client, Pydantic | Async Qloo calls in parallel; typed models; SSE built in |
| Database | Postgres on a free tier (Neon or Supabase); SQLite locally | Cache and runs survive redeploys |
| LLM | One provider with tool calling; a small fast model for panelists and checks, a stronger one for orchestrator and analyst | Panelist calls are most of the volume |
| Agent loop | Plain tool-calling loop in Python, no framework | Fewer moving parts in 10 days; easy to explain to judges |
| Frontend | Next.js, Tailwind, a chart library (Recharts) | Fast to polish; deploys free on Vercel |
| Backend hosting | Railway or Fly.io | Free tiers that sleep cause 30 s+ cold starts that judges will hit; a few dollars a month avoids it |
| Repo | Public GitHub, MIT license set in the About section | Required by the rules |

### Cost per run (approximate, check current pricing)

- About 15 to 20 LLM calls: comparables 1, seeds 1, persona bios 1, panelists 6 to 10, regenerations about 2, checks batched into 1, moderator 1, analyst 1.
- 20 to 30 Qloo calls, mostly cache hits after the first run of a brief.
- With a small model for panelists, a run should cost cents. Set a hard daily spend cap anyway, since the demo must stay up and free until judging ends on Nov 16.

### Environments

- `local`: SQLite, `QLOO_MOCK=1`, a mock LLM, so the frontend can be built without spending quota.
- `prod`: real keys, Postgres, rate limits on, examples pre-warmed.

## 10-day build plan

The plan works backwards from one rule: a deployed, working URL by Oct 26, so the last four days go to proof and polish rather than firefighting.

&#91;embedded content: 10-day build plan · 5 phases, 2 gates, 2 owners\]

**Team split.** The backend owner builds the Qloo client, scoring, agents and deployment. That is the backend depth you want for your own learning. The frontend and design owner builds the screens, the report and charts, runs the founder sessions and records the video. Swap if your teammate is the stronger backend coder; design is 25% of the score and needs a real owner.

**If a gate fails.** At gate 1, switch the stance method to the top-N fallback and keep going. At gate 2, cut variants and the ungrounded comparison before cutting anything on the run itself.

## Submission and judging strategy

Submit by the evening of Oct 30 IST, about 12 hours before the deadline of Oct 30, 11:45 pm EDT (Oct 31, 9:15 am IST). A missing item fails stage 1 regardless of quality.

### Checklist ([rules](https://qloo.devpost.com/rules))

- [ ] Hosted app working end-to-end at a public URL, no login
- [ ] Public GitHub repo with all source, setup instructions and a `.env.example`
- [ ] MIT license, visible in the repo's About section
- [ ] Devpost text description: features and exactly what Qloo powers
- [ ] 2 to 3 minute demo video (optional in the rules, essential in practice)
- [ ] Free, unrestricted access kept live until judging ends on Nov 16
- [ ] All materials in English
- [ ] Written confirmation from the organizers that Indian residents are eligible

### Playing to each criterion (25% each)

| Criterion | What judges look for | How Proxy Panel shows it |
| --- | --- | --- |
| Technological implementation | Thorough, non-trivial Qloo use; working code | Stance and price computed from lift; validator; 20+ Qloo calls per run; architecture diagram in the README |
| Design | A complete product, not a proof of concept | One-click examples, streaming panel, receipts on hover, report that leads with a verdict |
| Potential impact | A credible case for a real problem and audience | Founder quotes; focus-group costs vs a free 90-second run; interview script that leads to real research |
| Quality of the idea | Creative, non-obvious use of Qloo | Comparable-brand lift as stance; price bands from taste; leave-one-out evidence |

### The video (2 to 3 minutes)

1. **0:00** A founder's problem in one sentence, with a real quote.
2. **0:15** Type a brief, confirm comparables.
3. **0:40** The panel streams in; hover a receipt.
4. **1:15** The report verdict.
5. **1:40** Flip to "without Qloo": the same question, visibly generic.
6. **2:05** The Evidence page: backtest results on 5 real brands.
7. **2:30** Close on the impact line and the URL.

Judges include investors, so the README and description should also state a plausible business path (paid runs for agencies, a research-tool add-on) in two lines.

## Risks and open questions

The biggest risk is a data one: if Qloo cannot score named comparable brands under a segment's signals, the stance math needs its fallback. Test that first, on day 1.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Insights cannot score a specific brand under given signals | Medium | High | `take=50` top-N fallback, rank as affinity proxy; decide by end of day 1 |
| Judges see it as "another Quorum" | Medium | High | Lead every pitch with segment, variant and price, not "synthetic focus group"; show the backtest |
| Demographic signal names or buckets differ from assumed | Medium | Medium | Seed entities carry the segment; demographics become optional |
| Personas still sound alike | Medium | Medium | Distinct seed subsets per persona; distinctness metric in validation; temperature tuned per persona |
| Monthly Qloo quota runs out | Low | High | Cache everything, mock mode for development, pre-warmed examples, per-IP limits |
| LLM cost spike from public traffic | Low | Medium | Daily spend cap that falls back to examples |
| Run takes over 2 minutes | Medium | Medium | Parallel calls, streaming, cheap model for panelists |
| Weak coverage outside the US | Medium | Low | Demo with US brands; market toggle stays stretch |
| India eligibility | Low | High | Email the organizers on day 1 |

### Open questions

- Which LLM provider: decide by cost and tool-calling reliability on day 1.
- Which product category for the three examples? Recommended: functional beverages, clean personal care, and a consumer app, because Qloo's brand coverage is likely deepest there.
- Do we include an Indian D2C example? Only if day-1 tests show good Qloo data for Indian brands.
- Who are the 3 real founders, and can we book them by Oct 27?
