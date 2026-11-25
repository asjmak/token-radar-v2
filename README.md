# Token Radar v2 — fitted-comp-1

A token launch radar for the make.fun token-radar-01 bounty. It reads the
sealed DefiLlama snapshot, prices every pre-token protocol with a valuation
model fitted on the snapshot's own traded tokens, and ranks a 198-row board
by expected launch value.

## The model

- **Fitted value model.** log10(mcap) = 3.5795 + 0.4412 x log10(TVL) plus
  shrunk per-category offsets, fitted by least squares on 94 launch-comparable
  traded protocols, with an outlier trim refit inside every validation fold.
- **Held-out validation.** Every candidate term was kept or dropped on two
  blind tests: leave-one-out (median error x3.51) and walk-forward over the
  dated comps (median error x2.88). Age stayed; growth and chain count were
  dropped, and the dashboard cover prints every trial with its numbers.
- **Token odds.** A launched-by-age curve fitted from the snapshot's own
  record, adjusted by a shrunk category factor. Each row shows both the
  launch value and the expected value (launch x odds), and the board ranks
  by expected value.
- **Farm verdicts.** Every row carries a costed plan: gas, a 5%/yr lock-up
  charge, hours, $/hour and the break-even capture share, netted to a
  FARM / THIN / SKIP verdict.
- **Full accounting.** All 758 snapshot protocols are accounted for:
  416 already launched, 198 ranked here, 144 set aside with named reasons.

## Layout

- `main.ts` — reads `/input/snapshot.json`, writes `board.json`, the
  dashboard data, and `dossier.json` via the vendored board library.
- `lib/model.ts` — the fitted model, term trials, odds and the board.
- `lib/farm.ts` — the costed farm plans.
- `dashboard/` — a static page (board, detail view, filters) that renders
  with no network and re-derives its own headline claims in an integrity
  strip on the cover.
- `screenshots/` — the board, a detail view and a filtered view.
- `NOTES.md` — coefficients, validation receipts and the v1 comparison.

## Run

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

MIT licensed.
