# Milestone Submission — Phase 4

Paste-ready fields for the GenLayer Contribution Portal.

---

## Title
```
ReviewGuard Phase 4 — On-Chain Reputation Registry + Trust Leaderboard
```

## Changes & Improvements (under 500 chars, non-tech, no dashes)
```
One off checks now build a lasting record. Every analysis and every cross platform source is folded into a per domain reputation kept on chain: how often it was checked, its verdict mix, its average trust score, and how often its platforms disagreed. Each domain earns a tier from Trusted to Flagged, recomputed on read, and any cross platform disagreement caps it at Watch. The result is a public trust leaderboard anyone can query for free, plus a reputation badge on every result.
```

## Evidence Links (Phase 4) — distinct from every other phase

1. **Contract v0.5.0 deploy transaction** (new deployment):
   https://explorer-studio.genlayer.com/tx/0x38bf02e76804ad78e8d8716e3c23a755f642e977a03ecae2f88e8a54804c3b0c

2. **Phase 4 commit** (whole feature in one diff):
   https://github.com/phu1271997/reviewguard/commit/17450c0

3. **On-chain transaction that populated the registry** — analyze on v0.5.0 that created the `apps.apple.com` DomainRep (verdict TRUSTWORTHY 85 → tier TRUSTED):
   https://explorer-studio.genlayer.com/tx/0x407cabaccf67dcc8c1dd022b3afed132e5f09c39d05427d9336ae88d00ba0563

4. **New reputation test file** (5 cases):
   https://github.com/phu1271997/reviewguard/blob/main/tests/test_reputation.py

5. **Contract on the studionet explorer** (v0.5.0 address):
   https://explorer-studio.genlayer.com/address/0x1aBBd65985FB802a5eDDb362193338dF0FF2F8cf
