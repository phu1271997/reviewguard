# ReviewGuard

**An on-chain fake-review detector.** Paste the URL of any review page — a Google
Maps place, a marketplace product, a listing — and an **Intelligent Contract on
GenLayer reads that page live** (`gl.nondet.web.render`) and **reasons with an
LLM** (`gl.nondet.exec_prompt`) to judge how authentic the reviews look. It
returns a verdict, a 0–100 trust score, and concrete red flags, all stored
on-chain.

> **Why this dies without GenLayer:** the whole product is an on-chain agent that
> *fetches a web page and judges writing authenticity*. A normal smart contract
> can't read the web or reason about language. Remove the web-read + LLM and
> there's nothing left. No money changes hands — the judgement itself is the
> product, and it's produced trustlessly by validator consensus, not on a
> server we control.

---

## How it works

```
user ──► analyze(url) ──►  ┌─────────── on-chain ───────────┐
                           │ gl.nondet.web.render(url)       │
                           │ gl.nondet.exec_prompt(grade it) │
                           │ eq_principle.prompt_comparative │  ← validators agree
                           │   → verdict + trust_score       │     on MEANING
                           └────────────┬────────────────────┘
                                        ▼
                    stored on-chain: verdict, score, red_flags, summary
                                        ▼
              frontend reads it back and renders the trust gauge
```

**Consensus checks meaning, not shape (Axis 2).** The analysis runs inside
`gl.eq_principle.prompt_comparative(fn, principle)`. Validators don't require
byte-identical JSON — they use NLP to confirm the leader's and their own analysis
reach the **same verdict** and a **close trust score**. Two validators disagreeing
on the verdict can't both pass.

**Edge cases handled:** page unreachable/empty → `UNRESOLVABLE` (score 0); LLM
returns malformed JSON → coerced to `UNRESOLVABLE`; non-review page → the model
is instructed to answer `UNRESOLVABLE`; bad/relative URL → rejected before any
nondet call.

---

## Repo layout

```
reviewguard/
├── contracts/
│   ├── ReviewGuard.py     # the Intelligent Contract (heart of the project)
│   └── storage_test.py    # minimal sanity contract — deploy FIRST
├── frontend/              # genlayer-js + React (Vite) app
│   ├── src/genlayer.js    # contract client wrapper
│   ├── src/App.jsx        # analyze flow + trust gauge + history
│   └── ...
├── scripts/deploy.js      # scriptable testnet deploy
└── README.md
```

---

## 1. Deploy the contract on GenLayer Studio

1. Open **https://studio.genlayer.com/run-debug**
2. **Settings → Reset Storage → Confirm**, then hard refresh (Cmd+Shift+R / Ctrl+Shift+F5).
3. Deploy **`contracts/storage_test.py` FIRST** to confirm the environment works.
   Click the tx in the sidebar → verify **`Result: SUCCESS`** (not just `FINALIZED`).
4. Deploy **`contracts/ReviewGuard.py`**. Constructor takes **no arguments**.
   After deploy, click the tx → verify **`Result: SUCCESS`**.
5. **Copy the contract address** — you'll paste it into the frontend env.

Troubleshooting: `Could not load contract schema` → a storage type problem (this
project already uses `@allow_storage @dataclass` structs and `str`-keyed
`TreeMap`s, so it shouldn't occur). `Contract Queues not found` → line 1 isn't
exactly `# v0.2.16`.

---

## 2. Run the frontend

```bash
cd frontend
cp .env.example .env
# edit .env → VITE_CONTRACT_ADDRESS=<address from step 1>
npm install
npm run dev        # http://localhost:5173
```

Flow: paste a review-page URL → **Analyze** → wait ~5–30s while validators reach
consensus (a loading state is shown) → the trust gauge, verdict, and red flags
appear, and the analysis is added to the on-chain history.

### Deploy the frontend to Vercel

1. Push this repo to GitHub.
2. Import it on Vercel, set **root directory = `frontend`**.
3. Add env var **`VITE_CONTRACT_ADDRESS`** = your deployed address.
4. Deploy. (`vercel.json` sets build = `npm run build`, output = `dist`.)

The frontend is a standard Vite + React app and builds cleanly (`npm run build`
produces `dist/`). It pins `genlayer-js@^1.1.8`, which exports the `studionet`
chain used to reach Studio.

---

## Contract API

| Method | Kind | Purpose |
|---|---|---|
| `analyze(url)` | write | read the page on-chain + LLM-grade authenticity; stores + returns the new id |
| `get_analysis(analysis_id)` | view | one analysis as JSON |
| `list_analyses()` | view | all analyses as JSON |
| `find_by_url(url)` | view | cached analysis for a URL (or `{}`) |
| `get_total()` | view | number of analyses |

Analysis JSON shape:
```json
{
  "analysis_id": 0,
  "url": "https://…",
  "requester": "0x…",
  "verdict": "TRUSTWORTHY | MIXED | SUSPICIOUS | UNRESOLVABLE",
  "trust_score": 0,
  "red_flags": ["…"],
  "summary": "…"
}
```

---

## Design notes (GenLayer rules honoured)

- Every contract starts with `# v0.2.16` + the `Depends` comment; imports via
  `from genlayer import *` only.
- Custom storage structs use `@allow_storage @dataclass` (there is no `Record`).
- `TreeMap` keys are `str` (calldata only supports string-keyed maps); analyses
  are keyed by `str(analysis_id)`.
- All persisted integers are `bigint` (not `u256`/`int`).
- Non-deterministic `web.render` / `exec_prompt` calls live inside a function
  passed to `gl.eq_principle.prompt_comparative`, and never touch `self`.
- No `float`, no `dict`/`list` storage; class named exactly `Contract`;
  `TreeMap` never reassigned in `__init__`.
- No token transfers → none of the payable/`emit_transfer` pitfalls apply.

---

## Pitch

**ReviewGuard dies without GenLayer:** without an on-chain contract that reads a
live review page and reasons about authenticity with an LLM, there is no
trustless judge — you'd be back to trusting whatever server ran the model.
