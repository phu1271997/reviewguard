# ReviewGuard

**An on-chain fake-review detector.** Paste the URL of any review page — an App
Store listing, a Google Maps place, a marketplace product — and an **Intelligent
Contract on GenLayer reads that page live** (`gl.nondet.web.render`) and
**reasons with an LLM** (`gl.nondet.exec_prompt`) to judge how authentic the
reviews look. It returns a verdict, a 0–100 trust score, and concrete red flags,
all stored on-chain.

- **Live app:** https://reviewguard-chi.vercel.app/
- **Deployed contract (v0.2.0):** [`0x07c581dd42f4EEf985b32C4e62cc115dEF128585`](https://explorer-studio.genlayer.com/address/0x07c581dd42f4EEf985b32C4e62cc115dEF128585) on GenLayer **studionet** (status: Preview)
- **Docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [SECURITY.md](./SECURITY.md) · [CHANGELOG.md](./CHANGELOG.md) · [ADR-0001](./docs/ADR-0001-consensus-choice.md)
- **Previous deploy (v0.1.0, retired):** `0x99e35870DBDDa556C5f11DF6542d6E31EA074655` — kept live for reference; the Vercel app now points at v0.2.0.
- **Sample verdicts on-chain today:**
  `TRUSTWORTHY` — [Discord on the App Store](https://apps.apple.com/us/app/discord/id985746746) (trust 82) ·
  `SUSPICIOUS` — [Temu on the App Store](https://apps.apple.com/us/app/temu-shop-like-a-billionaire/id1641486558) (trust 35) ·
  `MIXED` — [Facebook on the App Store](https://apps.apple.com/us/app/facebook/id284882215) (trust 58) ·
  `UNRESOLVABLE` — [Wikipedia article](https://en.wikipedia.org/wiki/Inception_(film)) (not a review page)

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
│   ├── ReviewGuard.py         # the Intelligent Contract (heart of the project)
│   └── storage_test.py        # minimal sanity contract — deploy FIRST
├── frontend/                  # genlayer-js + React (Vite) app
│   ├── src/genlayer.js        # contract client wrapper
│   ├── src/App.jsx            # analyze flow + trust gauge + history
│   └── ...
├── tests/                     # gltest test suite (see below)
│   ├── conftest.py            # session-scoped deploy + retry helper
│   ├── test_deploy_and_views.py
│   ├── test_url_validation.py
│   └── test_analyze_edge_cases.py   # opt-in slow tests: real LLM + web.render
├── gltest.config.yaml         # gltest network config (defaults to studionet)
├── pytest.ini                 # pytest markers (slow)
├── scripts/deploy.js          # scriptable studionet deploy
└── README.md
```

---

## 1. Deploy your own contract on GenLayer Studio (only if you want a fresh one)

The address above is already live and the frontend at `reviewguard-chi.vercel.app`
points at it. If you want to redeploy under your own account, follow these steps
and then update `VITE_CONTRACT_ADDRESS`.


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

## 3. Tests

The suite uses [`gltest`](https://pypi.org/project/genlayer-test/) and defaults
to studionet (same network the live app targets). Tests deploy a fresh
`ReviewGuard` contract per session and reuse it.

```bash
python3 -m pip install genlayer-test
gltest -m "not slow"     # 8 fast tests (~3 min) — deploys once, hits view methods + URL validation
gltest                   # +3 slow tests (~5 min extra) — real LLM + web.render across dead URLs,
                         #   non-review pages, and a happy-path App Store review
```

Fast tests cover: deploy succeeds and initial state is empty; view methods
(`get_total`, `list_analyses`, `find_by_url`, `get_analysis`) shapes and
missing-id error; URL validation rejects `ftp://`, missing scheme, empty
string, `javascript:`, and other non-http schemes — as failed executions, not
state advances.

Slow tests cover the edge cases the contract must degrade on: an unreachable
domain → `UNRESOLVABLE` (trust 0), a reachable-but-not-review page (Wikipedia)
→ `UNRESOLVABLE`, and a real App Store review page → any of the valid verdicts
with a well-formed record. They also confirm `find_by_url` caches the analysis
id so a repeat lookup is free.

Studio RPC is occasionally flaky (transient `RemoteDisconnected`), so the tests
retry each call up to 3× with backoff via `retry_call` in `tests/conftest.py`.

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
