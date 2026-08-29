// src/App.jsx
// ReviewGuard — paste a review page URL, an on-chain Intelligent Contract
// fetches the page live, and an LLM grades how authentic the reviews look.
// Verdict + 0-100 trust score + concrete red flags, stored on-chain by
// validator consensus, not on a server.

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  CONTRACT_ADDRESS,
  getAccount,
  listAnalyses,
  analyze,
  findByUrl,
  explorerAddressUrl,
  explorerTxUrl,
} from "./genlayer.js";
import "./styles.css";

const VERDICT_META = {
  TRUSTWORTHY: { color: "var(--good)", label: "Trustworthy" },
  MIXED: { color: "var(--warn)", label: "Mixed signals" },
  SUSPICIOUS: { color: "var(--bad)", label: "Suspicious" },
  UNRESOLVABLE: { color: "var(--muted)", label: "Unresolvable" },
};

const SAMPLES = [
  { label: "Trustworthy example", url: "https://apps.apple.com/us/app/discord/id985746746" },
  { label: "Mixed example", url: "https://apps.apple.com/us/app/facebook/id284882215" },
  { label: "Suspicious example", url: "https://apps.apple.com/us/app/temu-shop-like-a-billionaire/id1641486558" },
];

const NAV_ITEMS = [
  { id: "try", label: "Try it" },
  { id: "problem", label: "Problem" },
  { id: "verdicts", label: "Verdicts" },
  { id: "how-it-works", label: "How it works" },
  { id: "signals", label: "Signals" },
  { id: "cases", label: "Use cases" },
  { id: "analyses", label: "History" },
  { id: "compare", label: "Compare" },
  { id: "faq", label: "FAQ" },
];

function short(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState(null);
  const [txHash, setTxHash] = useState("");

  const me = (() => {
    try { return getAccount()?.address ?? null; } catch (e) { return null; }
  })();

  const refresh = useCallback(async () => {
    try {
      setError("");
      const list = await listAnalyses();
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);
      if (arr.length > 0) setLatest((prev) => prev || arr[arr.length - 1]);
    } catch (e) {
      setError("Could not read analyses: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const stats = useMemo(() => {
    const total = items.length;
    const bucket = { TRUSTWORTHY: 0, MIXED: 0, SUSPICIOUS: 0, UNRESOLVABLE: 0 };
    let sumScore = 0, scoredCount = 0;
    for (const a of items) {
      const v = a.verdict in bucket ? a.verdict : "UNRESOLVABLE";
      bucket[v]++;
      if (v !== "UNRESOLVABLE") { sumScore += Number(a.trust_score) || 0; scoredCount++; }
    }
    const avg = scoredCount > 0 ? Math.round(sumScore / scoredCount) : null;
    return { total, bucket, avg };
  }, [items]);

  async function runAnalyze(target) {
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      setError("Enter a full URL starting with http:// or https://");
      return;
    }
    setError(""); setBusy(true); setLatest(null); setTxHash("");
    try {
      await analyze(target, (hash) => setTxHash(hash));
      let found = null;
      for (let i = 0; i < 5; i++) {
        try { found = await findByUrl(target); if (found) break; } catch (_) {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      setLatest(found);
      setUrl("");
      await refresh();
    } catch (e) {
      setError("Analysis failed: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function onAnalyze() { runAnalyze(url.trim()); }

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="shell">
        <div className="banner error">
          <strong>No contract address configured.</strong> Deploy{" "}
          <code>ReviewGuard.py</code> on GenLayer Studio, then set{" "}
          <code>VITE_CONTRACT_ADDRESS</code> in your environment.
        </div>
      </div>
    );
  }

  return (
    <>
      <NavBar />
      <div className="shell">
        <Hero me={me} stats={stats} />

        <StatsStrip stats={stats} />

        <section className="panel" id="try">
          <div className="panel-head">
            <div className="panel-eyebrow">Try it</div>
            <h2 className="panel-title">Analyze a review page on-chain</h2>
          </div>
          <label className="field">
            Review page URL
            <div className="input-row">
              <input
                placeholder="https://apps.apple.com/us/app/discord/id985746746"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !busy) onAnalyze(); }}
                disabled={busy}
              />
              <button className="primary" disabled={busy} onClick={onAnalyze}>
                {busy ? "Analyzing…" : "Analyze"}
              </button>
            </div>
          </label>
          <div className="samples">
            <span className="samples-label">One-click:</span>
            {SAMPLES.map((s) => (
              <button key={s.url} className="sample" disabled={busy}
                onClick={() => { setUrl(s.url); runAnalyze(s.url); }} title={s.url}>
                {s.label}
              </button>
            ))}
          </div>
          {busy && (
            <div className="consensus">
              Reading the page on-chain and reaching validator consensus. Usually
              20–90 seconds — headless browser fetches the page, multiple validator
              LLMs must agree on the verdict.
              {txHash && (
                <> <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer">
                  Track this transaction ↗
                </a></>
              )}
            </div>
          )}
          {error && <div className="banner error">{error}</div>}
        </section>

        {latest && <FeatureCard a={latest} />}

        <ProblemSection />
        <VerdictSpecSection />
        <HowItWorksSection />
        <ArchitectureSection />
        <SignalsSection />
        <UseCasesSection />

        <section className="list" id="analyses">
          <div className="explain-eyebrow">On-chain history</div>
          <div className="list-head">
            <h2 className="explain-title">Every past analysis, verifiable on the explorer</h2>
            <button className="ghost" onClick={refresh}>Refresh</button>
          </div>
          <p className="explain-lede">
            Newest first. Click any row to expand its summary and red flags.
            Click the contract chip in the header to open the studionet explorer
            and audit every <code>analyze</code> transaction the contract has
            ever executed.
          </p>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="empty">No analyses yet. Paste a URL above to start.</div>
          ) : (
            items.slice().reverse().map((a) => (
              <Row key={a.analysis_id} a={a}
                onSelect={() => { setLatest(a); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            ))
          )}
        </section>

        <CompareSection />
        <FAQSection />
        <HowToUseSection />

        <Footer />
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NAV BAR
// ────────────────────────────────────────────────────────────────────────────
function NavBar() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="nav-brand" href="#top">
          <img src="/logo.png" alt="" />
          <span>ReviewGuard</span>
        </a>
        <div className="nav-links">
          {NAV_ITEMS.map((n) => (
            <a key={n.id} href={`#${n.id}`}>{n.label}</a>
          ))}
        </div>
        <a className="nav-cta" href="https://github.com/phu1271997/reviewguard"
           target="_blank" rel="noreferrer">GitHub ↗</a>
      </div>
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HERO
// ────────────────────────────────────────────────────────────────────────────
function Hero({ me, stats }) {
  return (
    <header className="hero" id="top">
      <div className="hero-left">
        <div className="brand">
          <img className="mark" src="/logo.png" alt="ReviewGuard logo" />
          <span className="brand-name">ReviewGuard</span>
        </div>
        <p className="hero-tag">
          An <strong>on-chain fake-review detector</strong>. Paste any review
          page — an App Store listing, a marketplace product, a place — and a
          GenLayer Intelligent Contract reads it live and grades how authentic
          the reviews look. Verdict, 0–100 trust score, concrete red flags.
          <br />
          <span className="hero-tag-em">The judgement is produced by validator consensus, not by our server.</span>
        </p>
        <div className="hero-cta">
          <a className="btn-primary" href="#try">Try it now →</a>
          <a className="btn-ghost" href="#how-it-works">How it works</a>
          <a className="btn-ghost" href="https://github.com/phu1271997/reviewguard"
             target="_blank" rel="noreferrer">View source</a>
        </div>
        <div className="chip-row">
          <span className="chip chip-live">
            <span className="live-dot" /> studionet · live · v0.2.0
          </span>
          <a className="chip" href={explorerAddressUrl(CONTRACT_ADDRESS)}
             target="_blank" rel="noreferrer">
            contract <code>{short(CONTRACT_ADDRESS)}</code> ↗
          </a>
          <span className="chip chip-muted">
            wallet <code>{short(me)}</code> · burner auto-funded
          </span>
        </div>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// STATS STRIP
// ────────────────────────────────────────────────────────────────────────────
function StatsStrip({ stats }) {
  const tiles = [
    { label: "Analyses on-chain", value: stats.total, sub: "since deploy" },
    { label: "Trustworthy", value: stats.bucket.TRUSTWORTHY, cls: "good" },
    { label: "Mixed", value: stats.bucket.MIXED, cls: "warn" },
    { label: "Suspicious", value: stats.bucket.SUSPICIOUS, cls: "bad" },
    { label: "Unresolvable", value: stats.bucket.UNRESOLVABLE, sub: "not a review page" },
    { label: "Avg trust score", value: stats.avg ?? "—", sub: "verdicts ≠ Unresolvable" },
  ];
  return (
    <section className="stats-strip" aria-label="On-chain stats">
      {tiles.map((t) => (
        <div key={t.label} className={"stat-tile " + (t.cls || "")}>
          <div className="stat-value">{t.value}</div>
          <div className="stat-label">{t.label}</div>
          {t.sub && <div className="stat-sub">{t.sub}</div>}
        </div>
      ))}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PROBLEM
// ────────────────────────────────────────────────────────────────────────────
function ProblemSection() {
  return (
    <section className="explain" id="problem">
      <div className="explain-eyebrow">The problem</div>
      <h2 className="explain-title">Fake reviews shape decisions worth real money.</h2>
      <p className="explain-lede">
        A five-star app, a top-rated restaurant, a "verified" seller — most
        people decide from a scroll of reviews they never questioned. But
        entire review markets are for sale: bot farms, referral bribes,
        coordinated bursts, paid takedowns. There is no neutral judge. The
        platforms themselves have incentives to look clean.
      </p>
      <div className="explain-grid">
        <div className="explain-card">
          <div className="explain-h">Reviews aren't neutral.</div>
          <p>Marketplaces moderate their own reviews. Reviewers get comped. Star ratings mask incentivized language. The signal you're seeing has already been curated by the party that benefits from it.</p>
        </div>
        <div className="explain-card">
          <div className="explain-h">An LLM alone isn't enough.</div>
          <p>You can ask ChatGPT "is this review fake?" and get an answer. But the answer lives on someone's server — same failure mode as trusting the platform. No shared record, no way to point at a judgement and say "consensus produced this, not us."</p>
        </div>
        <div className="explain-card">
          <div className="explain-h">A regular smart contract can't help.</div>
          <p>Solidity can't fetch a web page. It can't reason about writing style. Every prior attempt at bringing off-chain judgement on-chain needed an "oracle" — a middleman you have to trust anyway.</p>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// VERDICT SPEC
// ────────────────────────────────────────────────────────────────────────────
function VerdictSpecSection() {
  const specs = [
    { key: "TRUSTWORTHY", range: "typically 70–100", when: "Reviews look organic and varied — specific detail, different writing styles, no obvious templating or incentivized language.", color: "var(--good)" },
    { key: "MIXED", range: "typically 45–70", when: "Some manipulation signals but not dominant — mixed writing quality, aggregate vs sample mismatch, minor red flags.", color: "var(--warn)" },
    { key: "SUSPICIOUS", range: "typically 15–50", when: "Strong signs of fake or incentivized reviews — referral codes, coordinated bursts, templated praise, obvious bot patterns.", color: "var(--bad)" },
    { key: "UNRESOLVABLE", range: "score 0", when: "Not a review page (Wikipedia article, homepage, security check), or the page could not be loaded — the contract refuses to guess.", color: "var(--muted)" },
  ];
  return (
    <section className="explain" id="verdicts">
      <div className="explain-eyebrow">Verdict system</div>
      <h2 className="explain-title">Four labels the contract will return.</h2>
      <p className="explain-lede">
        Every analysis lands on one of these four labels plus a 0–100 trust
        score. The score range shown is typical — the LLM is free to place any
        analysis anywhere on 0–100 within its verdict.
      </p>
      <div className="verdict-grid">
        {specs.map((s) => (
          <div key={s.key} className="verdict-card" style={{ "--vc": s.color }}>
            <div className="verdict-pill" style={{ background: s.color }}>{s.key}</div>
            <div className="verdict-range">{s.range}</div>
            <p>{s.when}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ────────────────────────────────────────────────────────────────────────────
function HowItWorksSection() {
  return (
    <section className="explain" id="how-it-works">
      <div className="explain-eyebrow">How it works</div>
      <h2 className="explain-title">One on-chain function reads the page and judges it.</h2>
      <p className="explain-lede">
        Every step lives in the contract, not on our server. Multiple validators
        independently run the pipeline and must agree on the verdict before the
        record is allowed to land on-chain.
      </p>
      <ol className="flow">
        <li>
          <span className="flow-num">1</span>
          <div>
            <div className="flow-h">You paste a URL.</div>
            <p>The dApp calls <code>analyze(url)</code>. If the URL isn't <code>http://</code> or <code>https://</code> the contract rejects it before touching the network — no wasted gas, no fake result.</p>
          </div>
        </li>
        <li>
          <span className="flow-num">2</span>
          <div>
            <div className="flow-h">Validators fetch the page on-chain.</div>
            <p>Inside the non-deterministic block, each validator calls <code>gl.nondet.web.render(url)</code> — a real headless browser fetches the page as text. No oracle service. No cached snapshot. The page as it exists right now.</p>
          </div>
        </li>
        <li>
          <span className="flow-num">3</span>
          <div>
            <div className="flow-h">An LLM grades authenticity.</div>
            <p>The page text goes into <code>gl.nondet.exec_prompt</code> with a prompt covering templated wording, copy-paste praise, review bursts, rating-vs-text mismatch, incentivized language. It returns a verdict, a 0–100 trust score, red flags, and a summary.</p>
          </div>
        </li>
        <li>
          <span className="flow-num">4</span>
          <div>
            <div className="flow-h">Validators agree on meaning, not shape.</div>
            <p>The result is wrapped in <code>gl.eq_principle.prompt_comparative</code>. Validators don't demand byte-identical JSON — they use NLP to confirm they reached the <em>same verdict</em> and a close trust score. Two validators disagreeing on the verdict cannot both pass.</p>
          </div>
        </li>
        <li>
          <span className="flow-num">5</span>
          <div>
            <div className="flow-h">The record is written on-chain.</div>
            <p>Verdict, trust score, red flags, and summary land under a URL cache. Next time anyone queries the same URL, the answer is a free view call. Every past analysis is public — verify against the transaction on the studionet explorer.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE DIAGRAM
// ────────────────────────────────────────────────────────────────────────────
function ArchitectureSection() {
  return (
    <section className="explain" id="architecture">
      <div className="explain-eyebrow">Architecture</div>
      <h2 className="explain-title">Everything runs inside the contract's non-deterministic block.</h2>
      <p className="explain-lede">
        The dashed box is the consensus surface — every call inside it runs on
        each validator independently, then <code>eq_principle.prompt_comparative</code>
        checks the verdicts match before writing state.
      </p>
      <div className="arch-wrap">
        <svg className="arch" viewBox="0 0 900 420" preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)"/>
            </marker>
          </defs>

          {/* Actor: user */}
          <g>
            <rect x="20" y="180" width="130" height="60" rx="12" fill="var(--card)" stroke="var(--line)"/>
            <text x="85" y="207" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fill="var(--ink)" fontWeight="600">User (dApp)</text>
            <text x="85" y="225" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">paste URL</text>
          </g>

          {/* analyze() entry */}
          <g>
            <rect x="200" y="180" width="150" height="60" rx="12" fill="var(--card)" stroke="var(--accent)" strokeWidth="2"/>
            <text x="275" y="203" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fill="var(--ink)" fontWeight="600">analyze(url)</text>
            <text x="275" y="222" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="var(--muted)">@gl.public.write</text>
          </g>

          {/* Nondet block boundary */}
          <g>
            <rect x="380" y="30" width="500" height="360" rx="16" fill="none" stroke="var(--accent)" strokeDasharray="6 6" strokeWidth="1.5"/>
            <text x="630" y="20" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--accent)" fontWeight="600" letterSpacing="0.1em">NON-DETERMINISTIC BLOCK (runs on each validator)</text>
          </g>

          {/* web.render */}
          <g>
            <rect x="410" y="70" width="200" height="70" rx="12" fill="#fbfaf7" stroke="var(--line)"/>
            <text x="510" y="98" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fill="var(--ink)" fontWeight="600">web.render(url)</text>
            <text x="510" y="118" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">headless browser</text>
            <text x="510" y="132" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">fetches page text</text>
          </g>

          {/* exec_prompt */}
          <g>
            <rect x="640" y="70" width="220" height="70" rx="12" fill="#fbfaf7" stroke="var(--line)"/>
            <text x="750" y="98" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fill="var(--ink)" fontWeight="600">exec_prompt(...)</text>
            <text x="750" y="118" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">LLM grades authenticity</text>
            <text x="750" y="132" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">→ verdict + score + flags</text>
          </g>

          {/* 3 validators */}
          <g>
            <rect x="410" y="175" width="450" height="80" rx="12" fill="#fbfaf7" stroke="var(--line)"/>
            <text x="635" y="196" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="13" fill="var(--ink)" fontWeight="600">Each validator runs the pipeline independently</text>
            <g fill="var(--accent)">
              <circle cx="475" cy="230" r="12"/>
              <circle cx="530" cy="230" r="12"/>
              <circle cx="585" cy="230" r="12"/>
              <circle cx="640" cy="230" r="12" opacity="0.7"/>
              <circle cx="695" cy="230" r="12" opacity="0.55"/>
              <circle cx="750" cy="230" r="12" opacity="0.4"/>
            </g>
            <text x="815" y="234" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">N validators</text>
          </g>

          {/* eq_principle.prompt_comparative */}
          <g>
            <rect x="410" y="290" width="450" height="80" rx="12" fill="var(--card)" stroke="var(--accent)" strokeWidth="2"/>
            <text x="635" y="315" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fill="var(--ink)" fontWeight="600">gl.eq_principle.prompt_comparative</text>
            <text x="635" y="335" textAnchor="middle" fontFamily="Inter" fontSize="12" fill="var(--ink)">NLP-checks all validators reached the <tspan fontWeight="600">same verdict</tspan> + close score</text>
            <text x="635" y="352" textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--muted)">disagreements can't both pass → tx fails</text>
          </g>

          {/* Arrows */}
          <line x1="150" y1="210" x2="200" y2="210" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#arrow)"/>
          <line x1="350" y1="210" x2="405" y2="210" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#arrow)"/>
          <line x1="510" y1="140" x2="510" y2="175" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#arrow)"/>
          <line x1="750" y1="140" x2="750" y2="175" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#arrow)"/>
          <line x1="635" y1="255" x2="635" y2="290" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#arrow)"/>
        </svg>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SIGNALS
// ────────────────────────────────────────────────────────────────────────────
function SignalsSection() {
  const signals = [
    { title: "Templated wording", body: "Multiple reviews reusing the same phrasing, cadence, or structure — a signature of copy-paste review farms." },
    { title: "Generic praise", body: "Effusive but empty language (\"amazing product, changed my life\") with no concrete detail specific to the item." },
    { title: "Suspicious bursts", body: "Many similar reviews clustered in a short window — a classic sign of coordinated posting or a paid campaign." },
    { title: "Rating-vs-text mismatch", body: "Five stars alongside actual complaints, or one star alongside praise — the writer wasn't reading their own rating." },
    { title: "Incentivized language", body: "Referral codes, \"use my link,\" bonus mentions, or explicit \"got this for free in exchange for a review.\"" },
    { title: "Reviewer history absent", body: "Every review comes from a first-time or single-review account — the signature of a burner reviewer network." },
    { title: "Marketing tone", body: "Sales-copy language and superlatives that echo the product page itself, suggesting the review was written by the seller." },
    { title: "Rating manipulation", body: "Aggregate rating is high but the visible top reviews are critical — the sample doesn't support the headline number." },
  ];
  return (
    <section className="explain" id="signals">
      <div className="explain-eyebrow">Signals we look for</div>
      <h2 className="explain-title">What the LLM checks on every page.</h2>
      <p className="explain-lede">
        These are the eight signals the prompt asks the LLM to weigh. The
        verdict is a summary judgement across all of them — the red flags on
        every result card tell you which of these actually showed up.
      </p>
      <div className="signals-grid">
        {signals.map((s, i) => (
          <div className="signal" key={s.title}>
            <div className="signal-num">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <div className="signal-h">{s.title}</div>
              <p>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// USE CASES
// ────────────────────────────────────────────────────────────────────────────
function UseCasesSection() {
  const cases = [
    { who: "Shoppers", pitch: "Sanity-check a five-star product page or App Store listing before spending. See the on-chain verdict, not the seller's curated snippet." },
    { who: "Moderators & trust teams", pitch: "Use ReviewGuard as an evidence layer when investigating suspected fake-review campaigns. Every analysis is timestamped on-chain and citable." },
    { who: "Marketplace operators", pitch: "Integrate the contract as a second opinion in your review pipeline — cache lookups are free, and the judgement is produced by parties you don't control." },
    { who: "Researchers & journalists", pitch: "Build datasets of authenticity verdicts across categories without running your own scoring stack. Reproducible from the contract history." },
    { who: "Consumer advocates", pitch: "Publish verdicts on suspected review-farming vendors with a public on-chain audit trail — no proprietary black box behind the claim." },
    { who: "Web3 & DAO governance", pitch: "Use the trust score as an input for reputation systems, grant allocations, or airdrop eligibility that touch review-driven metrics." },
  ];
  return (
    <section className="explain" id="cases">
      <div className="explain-eyebrow">Who it's for</div>
      <h2 className="explain-title">Use cases across trust, moderation, and research.</h2>
      <div className="cases-grid">
        {cases.map((c) => (
          <div className="case" key={c.who}>
            <div className="case-h">{c.who}</div>
            <p>{c.pitch}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMPARE
// ────────────────────────────────────────────────────────────────────────────
function CompareSection() {
  const rows = [
    { attr: "Reads the live web page", rg: "yes", plat: "no need — they own it", oracle: "requires a paid oracle", off: "yes, on someone's server" },
    { attr: "Judgement produced by consensus", rg: "yes (multi-validator NLP agreement)", plat: "no — internal team decision", oracle: "single node", off: "no — single LLM call" },
    { attr: "Verifiable audit trail", rg: "on-chain tx per analysis", plat: "opaque moderation logs", oracle: "on-chain but data trusted", off: "server-side logs, deletable" },
    { attr: "Incentive to look clean", rg: "none", plat: "high — reviews sell the product", oracle: "depends on operator", off: "depends on operator" },
    { attr: "Anyone can re-verify a past verdict", rg: "yes — free view call", plat: "no", oracle: "sometimes", off: "no" },
    { attr: "Cost per repeat lookup", rg: "free (URL cached)", plat: "opaque", oracle: "per-call fee", off: "per-call inference" },
  ];
  return (
    <section className="explain" id="compare">
      <div className="explain-eyebrow">Compare</div>
      <h2 className="explain-title">ReviewGuard vs the alternatives.</h2>
      <div className="compare-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th></th>
              <th className="col-us">ReviewGuard <small>on GenLayer</small></th>
              <th>Platform-native moderation</th>
              <th>Oracle-based scoring</th>
              <th>Off-chain LLM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.attr}>
                <td className="row-h">{r.attr}</td>
                <td className="col-us">{r.rg}</td>
                <td>{r.plat}</td>
                <td>{r.oracle}</td>
                <td>{r.off}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FAQ
// ────────────────────────────────────────────────────────────────────────────
function FAQSection() {
  const faqs = [
    { q: "Is this the LLM's answer, or the contract's answer?", a: "The contract's answer, which happens to be produced by an LLM inside a non-deterministic block. Multiple validators independently run the LLM. The result is only written on-chain if the validators' verdicts agree via gl.eq_principle.prompt_comparative — no single validator can push a lie through." },
    { q: "What if two validators disagree?", a: "The transaction fails consensus and the analysis is not stored. That is the whole point: 'we can't agree on this page' is preserved as an outcome, instead of one validator overriding the others." },
    { q: "Why did I get UNRESOLVABLE on a page that clearly has reviews?", a: "The site probably blocks headless browsers (Trustpilot, G2, Yelp, and most storefronts protected by Cloudflare do this), or renders reviews only via JavaScript that headless Chromium can't hydrate. UNRESOLVABLE is the contract correctly refusing to guess with no evidence." },
    { q: "Which sites actually render?", a: "Reliably: App Store listings, Wikipedia, small e-commerce, blog posts. Sometimes: Play Store, some Booking.com pages. Rarely: Amazon, Trustpilot, G2, Yelp — anti-bot walls dominate those." },
    { q: "Where is my wallet? I didn't install anything.", a: "The app generated a throwaway signing key in your browser's localStorage on first load. GenLayer studionet auto-funds burner keys for demo transactions, so nothing is charged to you. You can see the address as the 'wallet' chip in the header." },
    { q: "Can the analysis be tampered with after the fact?", a: "No — it is stored in contract state at a specific transaction. Anyone reading the same analysis_id later gets the same verdict, score, and red flags. To change it you would need to write a new analysis for the same URL, and both would remain visible in the on-chain history." },
    { q: "How long does one analysis take?", a: "20 to 90 seconds. The bulk is the LLM call running on each validator plus the consensus round. That is the trustless part of the design — the wait is the price of not trusting a single server." },
    { q: "Is this production-ready?", a: "It's on GenLayer studionet (status: Preview). Studionet is a hosted demo network — the code and consensus mechanism are real, but studionet is not a permanent chain. When GenLayer mainnet ships, redeploying the contract there is a one-command operation." },
  ];
  return (
    <section className="explain" id="faq">
      <div className="explain-eyebrow">FAQ</div>
      <h2 className="explain-title">Frequently asked questions.</h2>
      <div className="faq-list">
        {faqs.map((f, i) => (
          <FAQItem key={i} q={f.q} a={f.a} />
        ))}
      </div>
    </section>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"faq " + (open ? "faq-open" : "")}>
      <button className="faq-q" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <span className="faq-caret">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="faq-a">{a}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HOW TO USE
// ────────────────────────────────────────────────────────────────────────────
function HowToUseSection() {
  return (
    <section className="explain submit" id="submit">
      <div className="explain-eyebrow">How to use it</div>
      <h2 className="explain-title">Try it in one click — or paste any review page you care about.</h2>
      <p className="explain-lede">
        No wallet install. No funds needed. The app creates a throwaway signing
        key in your browser (visible as the wallet chip at the top). Studionet
        funds it automatically for demo transactions.
      </p>
      <div className="how-grid">
        <div className="how-step">
          <div className="how-h">1. Use a seeded example</div>
          <p>Scroll to the top and click any "One-click" chip — <em>Trustworthy</em> (Discord), <em>Mixed</em> (Facebook), or <em>Suspicious</em> (Temu). Each already has a verified on-chain record so you get a result fast.</p>
        </div>
        <div className="how-step">
          <div className="how-h">2. Paste your own URL</div>
          <p>Any page starting with <code>https://</code> works. Best results: App Store listings, Wikipedia, small e-commerce, blog reviews. Cloudflare-protected sites will land as <code>UNRESOLVABLE</code>.</p>
        </div>
        <div className="how-step">
          <div className="how-h">3. Watch consensus</div>
          <p>While validators work, the loading note surfaces a <em>Track this transaction ↗</em> link to the studionet explorer. You can watch the tx move from proposed → accepted → finalized in real time.</p>
        </div>
        <div className="how-step">
          <div className="how-h">4. Read the verdict</div>
          <p>The result card shows a colour-coded verdict pill, a trust score gauge (0–100), a plain-English summary of the judgement, and a bulleted list of specific red flags the LLM found.</p>
        </div>
        <div className="how-step">
          <div className="how-h">5. Come back for the history</div>
          <p>Past analyses are always visible below the panel. Clicking a row expands it. Clicking the contract chip opens the address on the studionet explorer to audit every <code>analyze</code> transaction ever executed.</p>
        </div>
        <div className="how-step">
          <div className="how-h">Something not working?</div>
          <p>If a tx hangs more than two minutes, click <em>Refresh</em> in Past analyses — it usually finalized without the browser noticing. If the wallet ever runs out, clear <code>localStorage</code> and reload to mint a fresh burner.</p>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FOOTER
// ────────────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="foot">
      <div className="foot-cols">
        <div className="foot-col foot-col-brand">
          <div className="brand">
            <img className="mark" src="/logo.png" alt="" />
            <span className="brand-name">ReviewGuard</span>
          </div>
          <p>An on-chain fake-review detector. Judgements produced by validator consensus on GenLayer studionet, not by a server.</p>
        </div>
        <div className="foot-col">
          <div className="foot-col-h">Product</div>
          <a href="#try">Try it</a>
          <a href="#verdicts">Verdict system</a>
          <a href="#signals">What we detect</a>
          <a href="#analyses">History</a>
        </div>
        <div className="foot-col">
          <div className="foot-col-h">Learn</div>
          <a href="#problem">The problem</a>
          <a href="#how-it-works">How it works</a>
          <a href="#compare">Compare</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="foot-col">
          <div className="foot-col-h">Ecosystem</div>
          <a href="https://github.com/phu1271997/reviewguard" target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href={explorerAddressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Contract on Explorer ↗</a>
          <a href="https://docs.genlayer.com/" target="_blank" rel="noreferrer">GenLayer docs ↗</a>
          <a href="https://studio.genlayer.com/" target="_blank" rel="noreferrer">GenLayer Studio ↗</a>
        </div>
      </div>
      <div className="foot-fine">
        <span>Contract <code>{CONTRACT_ADDRESS}</code> · network <strong>studionet</strong> · status <strong>Preview</strong></span>
        <span className="foot-note">Not affiliated with any of the review platforms mentioned. Verdicts are the LLM's judgement, produced by validator consensus.</span>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RESULT WIDGETS
// ────────────────────────────────────────────────────────────────────────────
function Gauge({ score, color }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  return (
    <svg className="gauge" viewBox="0 0 120 120" width="120" height="120" aria-hidden>
      <circle cx="60" cy="60" r={r} className="gauge-track" />
      <circle cx="60" cy="60" r={r} className="gauge-fill"
        style={{ stroke: color, strokeDasharray: `${dash} ${c}` }} />
      <text x="60" y="58" className="gauge-num">{pct}</text>
      <text x="60" y="76" className="gauge-cap">trust</text>
    </svg>
  );
}

function FeatureCard({ a }) {
  const meta = VERDICT_META[a.verdict] || VERDICT_META.UNRESOLVABLE;
  const flags = Array.isArray(a.red_flags) ? a.red_flags.filter(Boolean) : [];
  return (
    <section className="feature" style={{ "--vc": meta.color }}>
      <div className="feature-top">
        <Gauge score={Number(a.trust_score) || 0} color={meta.color} />
        <div className="feature-head">
          <span className="verdict-pill" style={{ background: meta.color }}>{meta.label}</span>
          <a className="feature-url" href={a.url} target="_blank" rel="noreferrer">{a.url} ↗</a>
          {a.summary && <p className="feature-summary">{a.summary}</p>}
        </div>
      </div>
      {flags.length > 0 && (
        <div className="flags">
          <div className="flags-label">Red flags</div>
          <ul>{flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function Row({ a, onSelect }) {
  const meta = VERDICT_META[a.verdict] || VERDICT_META.UNRESOLVABLE;
  const [open, setOpen] = useState(false);
  const flags = Array.isArray(a.red_flags) ? a.red_flags.filter(Boolean) : [];
  return (
    <article className="row" style={{ "--vc": meta.color }}>
      <button className="row-head" onClick={() => { onSelect(); setOpen(!open); }}>
        <span className="score-chip" style={{ color: meta.color }}>{a.trust_score}</span>
        <span className="row-verdict" style={{ color: meta.color }}>{meta.label}</span>
        <span className="row-url">{a.url}</span>
        <span className="row-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="row-body">
          {a.summary && <p>{a.summary}</p>}
          {flags.length > 0 && <ul>{flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          <a href={a.url} target="_blank" rel="noreferrer">Open page ↗</a>
        </div>
      )}
    </article>
  );
}
