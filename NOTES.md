# Token Radar v2 — build notes

Entry source for make.fun **token-radar-01** ("Build the best token launch radar"), model
**fitted-comp-1**, built from the kit at `~/workspace/makefun/token-radar-kit/token-radar-01-kit`.
This directory is source + local validation only: nothing is registered, bundled or submitted;
the main agent handles the repo, transcripts and submission.

## Layout

- `main.ts` — the program (Node 22, stdlib only). Reads `/input/snapshot.json` (or `--input`),
  writes `/output/board.json` and `/output/data.js`, copies `dashboard/` and `screenshots/`
  into `/output`, and writes `/output/dossier.json` last via the vendored library. Honours
  `MAKEFUN_OUTPUT_DIR` outside the grader's container.
- `lib/model.ts` — snapshot parsing, the fitted valuation model, term selection by blind
  tests, the launch-odds model, the board, the full accounting and the board self-check.
- `lib/farm.ts` — the costed farm plans: playbooks per category family plus the costing
  arithmetic (gas, lock-up, hours, $/hour, break-even capture, verdict).
- `dashboard/` — `index.html` + `app.css` + `app.js`, **27,019 bytes** in all, so the
  dossier's 65,536-byte text shows every file whole (verified: dossier text 27,285 bytes,
  no cut marker).
- `screenshots/` — three real renders of this dashboard (below).
- `vendor/makefun-board.ts` — the kit's dossier library, copied byte for byte (sha256
  `9ca51b6e…`, matches the kit's starter copy and kit.json); `LICENSE` is the starter's MIT
  license, likewise. These two are the only copied files; all other code was written fresh
  for v2 in-session.
- `.makefun/owner.json` — the claim file naming the account wallet.

## What changed from v1, and why

v1 ("peer-comp-2") priced a launch as TVL × a category's **median** mcap/TVL (shrunk by a
hand-picked prior) × three **hand-set** multipliers (momentum 0.6 weight, tenure 0.85–1.15,
breadth 2%/chain). Nothing in it was fitted, and nothing was ever tested on a protocol the
model hadn't seen. It sits outside the live top 50. The live leaders share a different
pattern — fitted terms, two held-out tests, token odds from the peers' record, an integrity
strip, full accounting of all 758 protocols, and costed farm verdicts — and v2 is built to
that pattern, with every number below produced by the code in this directory on the sealed
snapshot.

| | v1 — peer-comp-2 | v2 — fitted-comp-1 |
| --- | --- | --- |
| Value model | category median mcap/TVL, hand-shrunk; hand-set multipliers | log-log size curve + category offsets, **fitted** by least squares; adjustment terms fitted and blind-tested |
| Held-out validation | none | leave-one-out **×3.51** median (geo ×4.58); walk-forward **×2.88** median (geo ×5.33) |
| Ranking claim | implied value (launch price only) | **expected value = launch value × launch odds**, both columns on every row |
| Launch odds | none | fitted from the snapshot's own launch record: F(age) curve × category factor |
| Farm plans | steps with per-step cost/time, no totals | steps **plus** a costing per row: gas, lock-up, all-in $, hours, **$/hour**, break-even capture %, verdict FARM/THIN/SKIP (150 / 29 / 19) |
| Accounting | 198 ranked; the other 560 unmentioned | all **758** accounted: 416 launched, 198 ranked, 144 set aside with named reasons |
| Integrity | board self-check in the program only | program self-check **plus** a live integrity strip on the cover: the page re-derives filed values from the printed coefficients in the reader's browser (8 checks, all passing in the shipped screenshots) |
| Top of the board | Steakhouse Financial $783M (implied) | Steakhouse Financial $19.8M expected (launch $75.8M × odds 0.261) |

The v2 launch values are lower than v1's across the top: the fitted size curve's slope is
0.44, so the market's own record prices a $2.75B-TVL launch far below a flat median multiple
of TVL. That is the snapshot's evidence, not a modelling error.

## The fitted value model

Fit population: the traded protocols in launch-comparable categories — **94 comps**. Of the
128 protocols carrying both a TVL and a market cap, 34 sit in product categories (CEX,
Liquid Staking, Bridge, Canonical Bridge, Liquid Restaking, Restaked BTC) whose tokens are
not launches of the kind the board ranks, so they are evidence on the cover, not teachers of
the curve. The fit itself:

- **Size curve:** log10(mcap) = **3.5795 + 0.4412 × log10(TVL)**, least squares over the comps.
- **Category offsets:** each category's mean residual after the curve, shrunk toward the
  curve with a prior of 6 phantom comps. Largest: Basis Trading ×1.359 (7 comps), RWA ×1.241
  (9), Dexs ×1.154 (11), Yield ×0.946 (9), Lending ×0.548 (15).
- **Trim pass:** after the first fit, comps missed by more than 2.25σ of log residual are
  dropped and the model refit once — **4 comps trimmed** in the final fit. The trim is
  inside the pipeline: every blind-test fold refits it, so the scores below price the trim.
- **Age fallback:** undated protocols are priced with the dated comps' mean age term,
  2.6257 years.

### Term selection — two blind tests or the term is dropped

Baseline (curve + offsets only): leave-one-out ×3.57, walk-forward ×3.09 (median factor
error; walk-forward trains on the oldest 47 dated comps, tests on the newest 24). A term
joins only if adding it improves **both** medians by ≥0.5%:

| Term | Transform | LOO × | WF × | Verdict |
| --- | --- | --- | --- | --- |
| age | years listed, capped at 5 | 3.51 | 2.88 | **kept**, coefficient **+0.0096** per year |
| growth | clamp(change_7d, −40, +80)/100 | 3.53 | 2.50 | dropped — walk-forward loved it, leave-one-out did not (needed ≤3.49) |
| chains | min(extra chains, 5) | 3.26 | 3.47 | dropped — leave-one-out loved it, walk-forward did not |

Final model: **LOO ×3.51 median (geo ×4.58, n=94)**, **walk-forward ×2.88 median
(geo ×5.33, train 47 / test 24)**. The kept age coefficient is small — a decade of tenure
moves a price by ×1.25 — but it is what both tests approve, and the dropped terms are named
on the dashboard's cover with their trial numbers.

## The launch-odds model

F(a) is the share of dated protocols that record a token by age a, read in 6-month bands
and made monotone: F(0.5y)=0.33, F(1y)=0.40, F(2y)=0.47, F(3y)=0.76, F(4y)=0.81, F(5y)=0.89.
A protocol still tokenless at age a gets **odds = (F(a+2y) − F(a)) / (1 − F(a))** — of its
peers that reached a without a token, the share that launched within the next two years —
scaled by its category's own launch record (shrunk toward the market-wide share 0.5488 with
a prior of 10): Lending ×1.38 (share 0.76), Dexs ×1.31 (0.72), Risk Curators ×0.39 (0.21),
CEX ×0.54 (0.30). Odds are clamped to [0.02, 0.90]; undated protocols get the dated
pre-token average age base, 0.5302, times their category factor. Because F flattens after
year four, the odds of old, still-tokenless protocols fall with age, as the leaders' boards
show. The board ranks by expected value; both factors are printed on every row and in every
detail view.

## Farm costing

Per row (assumptions printed on the cover): capital from a TVL tier ($50–$500); gas per
chain from a round-dollar table (Ethereum $9, most L2s $1, default $2), paid for setup/core
and half-weekly; lock-up cost 5%/yr on the capital over a 30–60-day hold set by the
protocol's age; the reader's minutes (setup 20, core 15, deepen 10, second chain 15, then
12 + 5 weekly). **$/hour = (gas + lock-up) / hours**; **capture = (gas + lock-up) /
expected value**. Verdict: FARM when odds ≥ 0.30, capture ≤ 0.25% and $/hour ≤ $25; THIN
when odds ≥ 0.15 and capture ≤ 1.2%; otherwise SKIP. Distribution over the 198 rows:
**FARM 150, THIN 29, SKIP 19**. Every plan has 7 steps (147–348 chars each), and the last
step states the row's own costing and verdict in words.

## Full accounting — all 758 protocols

416 already record a token (128 of them carry a market cap; the largest 24 are shown on the
cover as the peer evidence) · **198 ranked** (all 40 watchlist + 158 early candidates that
pass the watchlist's own structural screen) · 144 pre-token set aside, by reason: product
category CEX 42, Liquid Staking 38, Bridge 28, Canonical Bridge 15, Liquid Restaking 3,
Restaked BTC 2, versioned name 11, wrapped/staked word in name 5.

Top of the board (expected value): Steakhouse Financial $19.78M (launch $75.77M × 0.261),
Sentora Curator $18.82M ($75.20M × 0.250), BitFi Basis $17.86M ($25.46M × 0.702), OnRe
$17.55M, USDD $16.55M, Gauntlet $15.47M, OpenTrade $15.12M, Veda $14.74M, Plume Vaults
$14.29M, Hive Protocol $13.71M.

## The dashboard

Offline, no framework, no network references anywhere (the gate's scan passes). Warm-paper
editorial design (ink, vermilion, serif display heads), distinct from v1's navy. Board view:
masthead with the accounting, the model cover (formula with fitted coefficients, the
blind-test table with kept/dropped terms, the odds method, the farm-costing rule), the
**integrity strip** (8 live checks recomputed in the browser, including re-deriving the
filed launch values of ranks 1, 100 and 198 from the printed coefficients), search +
category + chain + set + verdict filters, five sort orders (expected, launch, TVL, odds,
cheapest hour), the ranked table, and the already-trading table. Detail view per protocol
(hash route `#/p/<slug>`): stat grid, the full pricing derivation (size curve, each
multiplier, the odds' two factors), the costed farm plan, and nearby rows.

## Screenshots

Real renders of the built output in Chrome headless shell (puppeteer from
`~/workspace/makefun/shot-tools/`), all 1440×1440:

| file | view | bytes |
| --- | --- | --- |
| `1-board.png` | board: cover, integrity strip, table head, PNG | 344,994 |
| `2-detail.jpg` | Steakhouse Financial detail, JPEG q92 | 320,901 |
| `3-filtered.jpg` | verdict = FARM, sort = cheapest hour, JPEG q94 | 331,160 |

## Gate validation (local, all seven rows)

RULES.txt states there is **no local grade** for this competition ("the server grades every
entry"), and the kit ships no local scorer — so, as for v1, the seven gate rows of RULES.txt
were implemented verbatim in a validator (kept outside the entry) and run on a real
`/output` produced by `main.ts` against the kit's sealed input:

- dashboard_files — PASS (3 files, 27,019 bytes, no network address in any scanned position)
- board_file — PASS (198 rows, 414,667 bytes, all slugs from the snapshot, values in range)
- sorted_by_value — PASS (ranks exactly 1..198, expected value non-increasing)
- coverage — PASS (all 40 watchlist slugs present)
- farm_steps — PASS (7 steps per row, 147–348 chars trimmed)
- screenshots — PASS (3 images, whole PNG/JPEG, 1440×1440, 321–345 KB each)
- dossier_matches — PASS (rebuilt with the vendored `buildDossier(output, {text_max_bytes:
  65536})`, byte-identical; dossier 1,357,993 bytes ≤ 1.5 MiB; dossier text 27,285 bytes,
  no cut marker)

Determinism: two consecutive runs of `main.ts` produced byte-identical `board.json`,
`data.js`, `dossier.json`, dashboard files and screenshot copies (no clocks, no randomness;
ages derive from the snapshot's own `as_of`; every sort has a slug tie-break; the fit, the
trim and both blind tests are pure arithmetic on the sealed input). Runtime ~0.2 s a run,
far inside the 120 s cap.

## Blockers

None for the build. For the parent's submission step: the entry still needs the transcript
bundle and either a public GitHub repo (with README badges + About per `how_to_submit`) or a
source-bundle `init` + submit with the account keypair — deliberately not done here.
