# Architecture — ReviewGuard

## System overview

ReviewGuard is a single Intelligent Contract on GenLayer studionet plus a
static React/Vite frontend on Vercel. There is no server-side component:
every judgement is produced by validator consensus during the on-chain
`analyze(url)` transaction.

```mermaid
flowchart LR
    User[User<br/>MetaMask or in-browser burner]
    FE[React + Vite dApp<br/>reviewguard-chi.vercel.app]
    RPC[Studio RPC<br/>studio.genlayer.com/api]
    Contract["Intelligent Contract<br/>ReviewGuard.py<br/>0x07c5...8585 v0.2.0"]
    NondetBlock{"analyze block<br/>runs on each validator"}
    Web["gl.nondet.web.render<br/>headless browser fetch"]
    LLM["gl.nondet.exec_prompt<br/>multi-perspective grading"]
    Consensus["gl.eq_principle.prompt_comparative<br/>validators agree on VERDICT + score within 15pts"]
    State[(TreeMap analyses<br/>+ TreeMap url_index)]
    Explorer[explorer-studio.genlayer.com]

    User --> FE
    FE -->|writeContract analyze url| RPC
    RPC --> Contract
    Contract --> NondetBlock
    NondetBlock --> Web
    NondetBlock --> LLM
    NondetBlock --> Consensus
    Consensus --> State
    Contract -->|readContract views| FE
    FE -.tx hash.-> Explorer
    User -.audit any past tx.-> Explorer
```

## The `analyze()` pipeline

Every call to `analyze(url)` runs the following stages. Everything from
"non-deterministic block enters" through "consensus check" happens on
**each validator independently**, then the result is only written on-chain
if all validators agree.

```mermaid
sequenceDiagram
    participant U as User dApp
    participant C as ReviewGuard.analyze
    participant V as Validator (xN)
    participant W as web.render
    participant L as exec_prompt
    participant E as eq_principle

    U->>C: writeContract(analyze, url)
    C->>C: URL schema check<br/>URL length cap<br/>URL control-char reject
    C->>V: enter nondet block
    V->>W: fetch URL as text
    W-->>V: page_text
    V->>V: canary check<br/>strip control chars<br/>cap to 9000 chars
    V->>L: multi-perspective prompt<br/>(forensic + skeptic + marketing)
    L-->>V: JSON verdict + score + flags
    V->>V: _normalize -> canonical JSON
    V->>E: leader + validators run same pipeline
    E->>E: verdict must match + score within 15pts
    E-->>C: consolidated result
    C->>C: coerce + clamp<br/>store Analysis in TreeMap
    C-->>U: analysis_id
```

## Contract storage layout

```mermaid
classDiagram
    class Contract {
        +Address owner
        +bigint next_id
        +TreeMap analyses str -> Analysis
        +TreeMap url_index str -> bigint
        +analyze(url) int
        +get_analysis(id) str
        +list_analyses() str
        +find_by_url(url) str
        +get_total() int
        +contract_version() str
    }
    class Analysis {
        +bigint analysis_id
        +str url
        +Address requester
        +str verdict
        +bigint trust_score
        +str red_flags
        +str summary
        +bool created
    }
    Contract "1" -- "*" Analysis
```

Every persisted integer is `bigint` (R14). Every `TreeMap` key is `str`
(R19). `Analysis` is `@allow_storage @dataclass` (R18). See
[SECURITY.md](./SECURITY.md) for the reasoning behind each choice.

## Trust boundaries

| Layer | Trusted for | Not trusted for |
|---|---|---|
| **Frontend** | rendering, URL formatting | verdict integrity — never asked to verify |
| **RPC** | tx propagation | verdict correctness — every validator re-runs |
| **web.render** | fetching URL text | any content that comes back (see [SECURITY.md](./SECURITY.md)) |
| **exec_prompt** | linguistic judgement | resisting prompt injection alone — canary + fences + multi-perspective |
| **eq_principle** | verdict-level agreement | byte-identical output — deliberately not required |
| **Storage** | permanent record | mutation after write — records are append-only |

## Frontend layout

```
frontend/
  index.html               <-- meta tags, favicon, og:image
  public/
    logo.png               <-- circular aperture mark
    favicon.png
  src/
    main.jsx               <-- React root
    App.jsx                <-- 10 sections + navbar + footer
    genlayer.js            <-- createClient wrapper, view/write helpers
    styles.css             <-- forensics-dossier theme
  vercel.json              <-- build cmd + output dir
  vite.config.js           <-- vite-plugin-node-polyfills for genlayer-js
```

The React app is single-file for now; splitting sections into per-file
components is a candidate for a future Phase (Loại 5b architecture refactor).

## Repository layout

```
reviewguard/
  contracts/
    ReviewGuard.py         <-- Intelligent Contract v0.2.0
    storage_test.py        <-- minimal sanity contract (deploy first)
  tests/
    conftest.py            <-- session-scoped deploy fixture
    test_deploy_and_views.py
    test_url_validation.py
    test_analyze_edge_cases.py
    test_security_hardening.py    <-- Phase 1 additions
  docs/
    ADR-0001-consensus-choice.md
  frontend/                <-- see above
  deliverables/            <-- Explorer submission bundle + logos
  scripts/deploy.js
  gltest.config.yaml
  pytest.ini
  CHANGELOG.md
  SECURITY.md
  ARCHITECTURE.md          <-- this file
  CONTRIBUTING.md
  README.md
```
