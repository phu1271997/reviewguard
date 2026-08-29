# ADR-0001 — Consensus API choice: `eq_principle.prompt_comparative`

- **Status**: Accepted
- **Date**: 2026-08-25 (initial); ratified in Phase 1 hardening 2026-08-29
- **Deciders**: ReviewGuard team

## Context

Every write in ReviewGuard runs a non-deterministic block (a headless-browser
web fetch and an LLM call). GenLayer offers three ways to wrap such a block
so validators can agree:

1. `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` — the low-level API.
   The validator can execute arbitrary Python to decide whether the leader's
   result is acceptable. No sandbox on validator errors: a validator
   exception collapses to `Disagree`, indistinguishable from a real refusal.
2. `gl.vm.run_nondet(leader_fn, validator_fn)` — the recommended low-level
   API. Same shape as `run_nondet_unsafe` but validator errors are sandboxed
   and mapped through `compare_user_errors` / `compare_vm_errors`.
3. `gl.eq_principle.prompt_comparative(fn, principle)` — a wrapper on top of
   `run_nondet` that auto-generates a validator function which asks another
   LLM whether the leader's result and the validator's result are equivalent
   under a natural-language `principle`.

## Decision

We use **`gl.eq_principle.prompt_comparative`** with a tightened principle
string (`CREDIBILITY_PRINCIPLE` in `contracts/ReviewGuard.py`).

## Rationale

- **Output is text with structured fields.** The result of `analyze()` is a
  JSON object with a verdict label, a trust score, a list of red flags, and
  a summary. The last two fields are open-ended prose — two validators
  reading the same page will produce different sentences almost every time.
  A byte-equal comparison (`strict_eq`) would fail consensus on every real
  call. A hand-written `validator_fn` that only compares verdict + score
  works but throws away one of GenLayer's advertised strengths.
- **The natural-language principle is the whole feature.** The rubric for
  Axis 2 explicitly rewards contracts that make validators agree on
  **meaning** rather than **shape**. `prompt_comparative` is precisely that
  — it uses NLP to check the two analyses reach the same *judgement* while
  tolerating different phrasing in the free-text fields.
- **Deprecates the `unsafe` variant.** Rules doc R7 warns that
  `run_nondet_unsafe` makes real disagreements indistinguishable from
  validator bugs; `prompt_comparative` is a strict upgrade in observability
  because it fails with an LLM-generated equivalence report rather than a
  silent `Disagree`.

## Consequences

- **Positive**: The contract passes the "consensus checks meaning, not
  shape" test. Two validators producing distinct English summaries can
  still both pass, so `analyze()` is a usable write. If they produce
  different verdict labels or scores >15 apart, the tx correctly fails.
- **Positive**: The equivalence check adds one extra LLM call per validator
  during consensus. Cost is real but linear in validator count, and this is
  what GenLayer sells.
- **Negative**: The tightening we did in v0.2 (`CREDIBILITY_PRINCIPLE`
  changed from "within about 20" to "within 15, exact verdict match
  required") narrows the acceptable band. If real production traffic
  produces false disagreements at the boundary, we may need to loosen it
  back or add a hysteresis rule. Monitored empirically via failure rate
  on the on-chain history.

## Alternatives considered

- **`strict_eq` on the raw JSON**: rejected — free-text fields differ
  between validators, causing near-100% failure.
- **`prompt_non_comparative` (single-side judgement)**: rejected — we want
  validators to independently re-run the analysis, not just grade the
  leader's output. Independent re-runs give a stronger integrity signal.
- **Hand-written `validator_fn` via `run_nondet`**: viable and considered
  for future phases if we want per-field structural rules (e.g. require
  overlap of at least one red flag). Not adopted now because the
  natural-language principle is easier to reason about and to explain to
  reviewers.
- **`run_nondet_unsafe`**: rejected outright per R7 — hides validator bugs.

## Related docs

- [SECURITY.md](../SECURITY.md) — threat model + injection defense
- [ARCHITECTURE.md](../ARCHITECTURE.md) — full pipeline diagram
- [CHANGELOG.md](../CHANGELOG.md) — Phase 1 tightening details
