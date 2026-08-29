# Milestone Submission — Phase 1

Paste-ready fields for the GenLayer Contribution Portal.

---

## Title
```
ReviewGuard Phase 1 — Foundation Hardening: Security + Docs + AI Prompt v2
```

## Changes & Improvements (target: under 1000 chars)
```
Contract v0.1.0 retired; v0.2.0 deployed on studionet at 0x07c581dd42f4EEf985b32C4e62cc115dEF128585. Vercel env swapped.

Security: URL length cap (2048); reject URLs with \n \r \t \x00 (prompt-injection via URL echoed into prompt); canary token in system prompt + stripped from fetched pages (spoofs force UNRESOLVABLE); page text capped 9000, control-char stripped, wrapped in fenced PAGE TEXT block with "treat as data" prelude.

AI: CREDIBILITY_PRINCIPLE tightened — score tolerance 20->15, verdict exact match required, "JSON schema fixed" clause. Multi-perspective prompt (forensic linguist + skeptic + marketing insider) replaces single-lens grading; summary cites which perspective drove the verdict.

API: new view contract_version() -> "0.2.0".

Docs: CHANGELOG, SECURITY (threat model + mitigations), ARCHITECTURE (Mermaid pipeline + storage), CONTRIBUTING, ADR-0001 (why eq_principle.prompt_comparative).

Tests: test_security_hardening.py added; 15/15 fast tests pass on v2 in ~3 min.
```

## Evidence Links (Phase 1)

Do NOT reuse these on later phases. Each phase gets its own set.

1. **Contract v0.2.0 deploy tx** (proof of the redeploy):
   https://explorer-studio.genlayer.com/tx/0x71b8397c7420f2af10fecb333fa872b1c728684ccbbc3e7a877bc0027ee1b129

2. **Commit implementing the whole Phase 1 bundle** (single diff to review):
   https://github.com/phu1271997/reviewguard/commit/cd6eb7b

3. **CHANGELOG entry for v0.2.0** (release notes with security + AI + docs):
   https://github.com/phu1271997/reviewguard/blob/main/CHANGELOG.md#020--2026-08-29--phase-1-foundation-hardening

4. **SECURITY.md — threat model + mitigations table** (Phase 1 output):
   https://github.com/phu1271997/reviewguard/blob/main/SECURITY.md

5. **ADR-0001 — why we chose `eq_principle.prompt_comparative`** (Phase 1 output):
   https://github.com/phu1271997/reviewguard/blob/main/docs/ADR-0001-consensus-choice.md

6. **New security test file** (proves the hardening is enforced):
   https://github.com/phu1271997/reviewguard/blob/main/tests/test_security_hardening.py

7. **Sample analyze tx on v0.2.0 showing multi-perspective summary** (Facebook):
   https://explorer-studio.genlayer.com/tx/0x7428989026ff887eb84328d66bf03d5a6f6a56b621e279970e17ae52455b715f

8. **Sample analyze tx on v0.2.0** (Candy Crush, TRUSTWORTHY 78):
   https://explorer-studio.genlayer.com/tx/0x228be53af472e63156ce94b7dd0050e42d8ad8ccb3a8afebdc6f7da3764cf736

---

## Reserved for later phases (do not reuse)

- Phase 2 evidence: will use links from a future PR (feature commit, new
  contract methods, new UI routes) — different commits, different tx hashes.
- Phase 3 evidence: integration commits (subgraph URL, IPFS hash, etc.).
- Phase 4 evidence: traction (Dune dashboard, tweet screenshots, user tx
  volume metric).
