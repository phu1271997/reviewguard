# GENLAYER PROJECT EXPLORER — SUBMISSION DRAFT
**Project:** ReviewGuard · **Prepared:** 2026-08-25 · **Status: READY**

---

## Section 01 — IDENTITY

### Logo
Upload one of these (both under 2 MB, spec: PNG 128–2048 px):
- `deliverables/logo-1024.png` — 1024×1024, ~1.1 MB, sharper
- `deliverables/logo-512.png`  — 512×512, ~300 KB, safer
- SVG source: `deliverables/logo-source.svg`

Concept: shield (guard) + star (rating) + 3 dashes (score gauge, 2 filled +
1 dimmed = "one review flagged"). Warm accent colour lifted from the app.

### Project name
```
ReviewGuard
```

### Primary category
```
Identity/Reputation
```
Reason: the contract issues a **reputation signal** (trust score + verdict) on
a review page. Not chosen: `AI & Agents` (every project in the catalogue is
AI-powered — the label doesn't distinguish anything). `Dispute Resolution` was
a close runner-up but the contract has no dispute or appeal flow — it only
issues a one-shot judgement on external content.

### Category tags
Only ONE tag genuinely fits; do NOT add a second one just to fill the field.

**Tag 1:** `Evidence Assessment`
The contract takes external evidence (the review page text fetched via
`gl.nondet.web.render`) and weighs signals (templated wording, incentivized
language, rating-vs-text mismatch) to produce a verdict + trust score. That
is literally evidence assessment.

**Tag 2:** leave blank — none of the remaining tags map to a real code path.
- `Escrow Claims` — no money changes hands, no escrow
- `Moderation Appeals` — the contract issues one judgement, no appeal flow
- `License Claims` — nothing about licences
- `Appeal Review` — no second-round review
- `Jury Selection` — validator selection is GenLayer's job, not the app's;
  the rubric explicitly says calling it "AI Jury" doesn't count.

If the form REQUIRES two tags, add `Moderation Appeals` as a stretch (the
verdict is what a marketplace moderator would use to decide takedowns) —
otherwise leave it blank. Prefer honest 1 tag.

---

## Section 02 — PROJECT SUMMARY

### One-liner (141 / 180)
```
Paste any review page URL and an on-chain contract reads the page live and judges how authentic the reviews look — no server in the middle.
```

### Description (954 / 1000)
```
ReviewGuard is a fake-review detector that lives inside a GenLayer Intelligent Contract. Paste any review page (an App Store listing, a Google Maps place, a product page) and the contract fetches the page on-chain with gl.nondet.web.render, then asks an LLM to grade authenticity: templated wording, copy-paste praise, bursts of similar reviews, rating-vs-text mismatch, incentivized language. It returns one of four verdicts (TRUSTWORTHY, MIXED, SUSPICIOUS, UNRESOLVABLE), a 0-100 trust score, and concrete red flags, all stored on-chain. A URL cache means repeat lookups are free view calls.

Consensus checks meaning, not shape. The nondet block runs inside gl.eq_principle.prompt_comparative — validators agree the verdicts match and trust scores are close, so two validators reaching different verdicts cannot both pass. A regular smart contract cannot fetch a web page or reason about writing. Remove the web read and the LLM and nothing remains.
```

---

## Section 03 — HOW TO TRY IT

### Prerequisites
- Chrome/Brave/Firefox on desktop.
- **No wallet install and no funds needed** — the app auto-generates a
  throwaway signing key stored in your browser and studionet auto-funds it
  for demo transactions. The wallet address is shown on the page.
- One analysis takes 20–90 seconds while validators reach consensus.

### Step 1 — Open the app
Go to https://reviewguard-chi.vercel.app/ . You'll see the header, the
"Review page URL" input, three "Try:" chips (Trustworthy / Mixed / Suspicious
example), and a list of Past analyses on-chain. Contract address is linked
in the header (chip) and footer.

### Step 2 — Run the seeded Trustworthy example
Click **Try: Trustworthy example**. The button fills the input with the
Discord App Store URL and starts analysis. A "Reading the page on-chain and
reaching validator consensus" note appears with a **Track this transaction**
link to the studionet explorer.

### Step 3 — See the verdict
Within ~30-90 seconds the loading state clears and a green **Trustworthy**
pill appears with a trust score (~80s), a short summary explaining the
judgement, and a list of red flags in plain English. The record is added to
Past analyses.

### Step 4 — Compare against a Suspicious example
Click **Try: Suspicious example** (Temu). You get a red **Suspicious** pill
with a score in the 20-50 range and red flags like "referral codes in top
reviews" or "mass-scale incentivized volume". This shows the model produced
a genuinely different verdict, not a stub.

### Step 5 — (Optional) Paste your own review page
Paste any URL starting with `https://`. Pages behind bot walls
(Trustpilot / G2 / Yelp / Cloudflare-guarded storefronts) will return
UNRESOLVABLE — that is by design (see edge case handling). App Store,
Wikipedia, small e-commerce, and blog pages generally render.

### Expected end state
Past analyses shows at least one Trustworthy result (Discord ~82), one
Suspicious result (Temu ~35), one Mixed (Facebook ~58), and at least one
UNRESOLVABLE (e.g. Wikipedia). Click the contract chip in the header to see
each `analyze` transaction on
`explorer-studio.genlayer.com/address/0x99e35870DBDDa556C5f11DF6542d6E31EA074655`.

### If something goes wrong
- **Transaction hangs > 2 min:** refresh the page and click Refresh in the
  Past analyses section — the tx often finalizes even if the browser gave up
  waiting.
- **"insufficient funds":** rare on studionet, but if it happens, clear
  `localStorage` (Application tab → Local Storage → delete `rg_pk`), reload
  to mint a fresh burner, and retry.
- **Verdict = UNRESOLVABLE on a page that clearly has reviews:** the site
  blocks headless browsers or renders reviews only via JavaScript that
  headless Chromium can't hydrate. Try App Store, Wikipedia, or a small
  Vietnamese e-commerce page — those are known to render.

---

## Section 04 — VERIFICATION

### Expected verification outcome (489 / 500)
```
Clicking "Trustworthy example" (Discord on the App Store) shows a green Trustworthy pill with a trust score in the 70-95 range and specific red flags in plain English. "Suspicious example" (Temu) returns a red Suspicious pill in the 20-50 range citing referral codes or incentivized language. "Mixed example" (Facebook) lands between. Every result was produced by validator consensus on studionet, not our server — click the contract chip to see the analyze transactions on the explorer.
```

### Contract link
```
https://explorer-studio.genlayer.com/address/0x99e35870DBDDa556C5f11DF6542d6E31EA074655
```

Address: `0x99e35870DBDDa556C5f11DF6542d6E31EA074655`
Network: **studionet**
Status: **Preview** (studionet = Preview; do not write "Live")

Verified 2026-08-25:
- `gen_getContractSchema` returns all 5 methods (analyze / get_analysis /
  list_analyses / find_by_url / get_total).
- Explorer address page shows 18 analyze transactions with `SUCCESS`
  results, including seeded TRUSTWORTHY / MIXED / SUSPICIOUS /
  UNRESOLVABLE records so a reviewer sees full diversity out of the box.

### Website
```
https://reviewguard-chi.vercel.app/
```

### GitHub
```
https://github.com/phu1271997/reviewguard
```

### Community links (optional)
Leave blank if none. Do not fabricate.

---

## PORTAL SUBMISSION CHECKLIST

**Truthfulness**
- [x] Every feature in the description is live at the URL above
- [x] No unbuilt features are described
- [x] Status Preview matches studionet deploy
- [x] The one category tag maps to a real code path

**Deploy state**
- [x] All commits pushed (verify with `git status` before submitting)
- [x] Vercel production build is the latest one (bundle hash `index-Lvjpqu_D.js`)
- [x] `gen_getContractSchema` returns 5 methods
- [x] Explorer address page shows tx `SUCCESS` / `Accepted`

**End-to-end test**
- [x] Seed data present: 1 TRUSTWORTHY (Discord, id 12), 1 SUSPICIOUS
      (Temu, id 15), 1 MIXED (Facebook, id 16), plus UNRESOLVABLE cases
- [x] Opened live URL in incognito with no wallet — Past analyses render

**Assets & limits**
- [x] Logo: 1024×1024 PNG, ~1.1 MB, under 2 MB spec
- [x] One-liner: 141 chars ≤ 180
- [x] Description: 954 chars ≤ 1000
- [x] Expected verification outcome: 489 chars ≤ 500
- [x] Website + GitHub both present

**Consequences understood**
- Changes requested = one fix, 14-day window
- Declined = no self-service resubmit — do not submit anything unproven
- One Projects contribution → one Explorer entry
