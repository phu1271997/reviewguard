# Milestone Submission — Phase 2

Paste-ready fields for the GenLayer Contribution Portal.

---

## Title
```
ReviewGuard Phase 2 — Appeal / Dispute Flow (on-chain stake-based re-analysis)
```

## Changes & Improvements (under 1000 chars)
```
Contract v0.2.0 retired; v0.3.0 at 0xda89fE3e166A21C4879fA8479F530B3e2e724eAe. Vercel env swapped.

Major feature: payable file_appeal(analysis_id, reason) stakes GEN to re-analyze the same URL under an adversarial prompt — LLM is told the prior verdict + score, asked to actively look for reasons to overturn, guided by the appellant's reason. Runs through the same tightened eq_principle consensus, so no single validator flips an outcome. On-chain status: OVERTURNED / UPHELD / UNRESOLVABLE.

Storage: new @allow_storage @dataclass Appeal (bigint / str), TreeMap[str, Appeal] appeals, next_appeal_id. New views: get_appeal, get_appeal_total, list_appeals, appeals_for.

Security: reason capped 10-2000, reject \n \r \x00, canary-scrub, fenced APPELLANT REASON block.

Frontend: appeal button on every result; AppealModal with reason + stake + live tx tracker; new Appeals section with 4-tile counters + expandable cards showing verdict delta.

Tests: 12 new cases in test_appeal.py — all pass.
```

## Evidence Links (Phase 2) — do NOT reuse from other phases

1. **Contract v0.3.0 deploy tx** (proof of the new deployment):
   https://explorer-studio.genlayer.com/tx/0x975904b29790df45edf833337306621d2811df699c4aec66cedfbf3e9fda1949

2. **Phase 2 commit** (whole feature in one diff):
   https://github.com/phu1271997/reviewguard/commit/fe4bec5

3. **On-chain appeal tx** showing status = UPHELD, original TRUSTWORTHY 82 → new TRUSTWORTHY 78 on Discord:
   https://explorer-studio.genlayer.com/tx/0x6a13e91ef0bd0bd4457d1962ddc57990ba5c6316b5cadde1c2455f2855be9acf

4. **New appeal test file** (12 cases, all pass):
   https://github.com/phu1271997/reviewguard/blob/main/tests/test_appeal.py
