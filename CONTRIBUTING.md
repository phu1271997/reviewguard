# Contributing to ReviewGuard

Thanks for wanting to make ReviewGuard better. Here's how the project is
structured and what makes a good contribution.

## Ground truth

- [ARCHITECTURE.md](./ARCHITECTURE.md) — pipeline diagrams + trust boundaries
- [SECURITY.md](./SECURITY.md) — threat model + mitigation table
- [CHANGELOG.md](./CHANGELOG.md) — what's changed and when
- [docs/ADR-0001-consensus-choice.md](./docs/ADR-0001-consensus-choice.md) — why we use `eq_principle.prompt_comparative`

If a proposal contradicts anything in those files, update the file in the
same PR — no PR should leave the docs stale.

## Setup

```bash
git clone https://github.com/phu1271997/reviewguard.git
cd reviewguard

# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173

# Tests (requires Python 3.11+)
cd ..
pip install genlayer-test
gltest -m "not slow"    # fast tests, ~3 min against studionet
```

## What makes a good PR

- **One thing at a time.** Security hardening, docs, and feature additions
  should be separate PRs. Bundle sub-fixes only when they share a rationale
  (see the Phase 1 Security bundle for the template).
- **Preserve the design rules.**
  - Every persisted integer is `bigint` (never bare `int`).
  - Every `TreeMap` key is `str`.
  - Custom storage structs are `@allow_storage @dataclass`, never `Record`.
  - No `float` anywhere.
  - The class is named `Contract` and inherits `gl.Contract`.
  - `TreeMap` fields are never assigned in `__init__`.
- **Update tests.** Any behaviour change needs a `gltest` case that would
  have caught the old behaviour. Fast tests run against studionet; slow
  tests require the LLM.
- **Update CHANGELOG.md.** Add an entry under an `[Unreleased]` header, or
  under a named phase if you're bundling with an existing phase.
- **Non-ASCII characters break the studionet schema loader.** Any
  documentation-style characters (em-dash, ellipsis, box-drawing) in
  `contracts/*.py` cause `UnicodeEncodeError` on `gen_getContractSchema`.
  Keep the contract file ASCII.

## Milestone-aligned contributions

If you're contributing toward a GenLayer Builder Program Milestone, the
Phase categories map to work types this project welcomes:

| Category | Examples we would accept |
|---|---|
| **Security** | more injection defenses, TreeMap-safe-read audit, per-address rate limiting |
| **AI enhancement** | stricter validator principle, additional prompt perspectives, better UNRESOLVABLE fallback |
| **New feature** | appeal/dispute flow, reputation system, encryption layer |
| **New integration** | The Graph subgraph, IPFS mirror of past analyses, WalletConnect |
| **UX / docs** | walkthrough video, translated README, mobile polish |

## Style

- Python: PEP-8, 100-char lines OK.
- JavaScript/JSX: no semicolons preference — match existing files, don't
  flip a whole file's style in a drive-by PR.
- Comments: leave them where they carry non-obvious context (see the WHY
  and CONSENSUS blocks at the top of `ReviewGuard.py`). Don't add doc
  comments that just repeat the function name.

## Reporting a security issue

Do not open a public issue. Use the private advisory link in
[SECURITY.md](./SECURITY.md#reporting-a-vulnerability).

## License

Contributions are accepted under the same license as the repository.
