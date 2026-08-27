// src/App.jsx
// ReviewGuard — paste a review page URL, the on-chain contract reads it and an
// LLM grades how authentic the reviews look. Full flow: submit URL → wait for
// consensus → see verdict + trust score + red flags. Past analyses are listed.
//
// Visual direction: "forensics dossier". Warm paper-grey canvas, a single ink
// accent, a big trust gauge as the signature element. Verdict color is the one
// place saturation is allowed.

import React, { useEffect, useState, useCallback } from "react";
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

// Server-side-rendered review pages that headless Chromium can actually read.
// Trustpilot / G2 / Yelp / Goodreads are behind bot-walls and return empty.
const SAMPLES = [
  { label: "Trustworthy example", url: "https://apps.apple.com/us/app/discord/id985746746" },
  { label: "Mixed example", url: "https://apps.apple.com/us/app/facebook/id284882215" },
  { label: "Suspicious example", url: "https://apps.apple.com/us/app/temu-shop-like-a-billionaire/id1641486558" },
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
    try {
      const acct = getAccount();
      return acct ? acct.address : null;
    } catch (e) {
      console.error("Failed to load account:", e);
      return null;
    }
  })();

  const refresh = useCallback(async () => {
    try {
      setError("");
      const list = await listAnalyses();
      const itemsList = Array.isArray(list) ? list : [];
      setItems(itemsList);
      if (itemsList.length > 0) {
        setLatest((prev) => prev || itemsList[itemsList.length - 1]);
      }
    } catch (e) {
      console.error("Failed to read analyses:", e);
      setError("Could not read analyses: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function runAnalyze(target) {
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      setError("Enter a full URL starting with http:// or https://");
      return;
    }
    setError("");
    setBusy(true);
    setLatest(null);
    setTxHash("");
    try {
      await analyze(target, (hash) => setTxHash(hash));
      // fetch the fresh analysis for this URL with polling to handle RPC lag
      let found = null;
      for (let i = 0; i < 5; i++) {
        try {
          found = await findByUrl(target);
          if (found) break;
        } catch (_) {}
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

  function onAnalyze() {
    runAnalyze(url.trim());
  }

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
    <div className="shell">
      <header className="hero">
        <div className="brand">
          <img className="mark" src="/logo.png" alt="ReviewGuard logo" />
          <span className="brand-name">ReviewGuard</span>
        </div>
        <p className="tag">
          Paste any review page — a place, a product, a listing. The contract
          reads it on-chain and an LLM grades how authentic the reviews look:
          bot patterns, copy-paste praise, suspicious bursts. The judgement lives
          on-chain, not on our server.
        </p>
        <div className="chip-row">
          <a className="chip" href={explorerAddressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
            contract <code>{short(CONTRACT_ADDRESS)}</code> ↗
          </a>
          <span className="chip chip-muted">
            wallet <code>{short(me)}</code> · burner auto-funded on studionet
          </span>
          <a className="chip" href="#how-it-works">how it works ↓</a>
        </div>
      </header>

      <section className="panel">
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
          <span className="samples-label">Try:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.url}
              className="sample"
              disabled={busy}
              onClick={() => { setUrl(s.url); runAnalyze(s.url); }}
              title={s.url}
            >
              {s.label}
            </button>
          ))}
        </div>
        {busy && (
          <div className="consensus">
            Reading the page on-chain and reaching validator consensus. This
            usually takes 20–90 seconds — a headless browser fetches the page and
            multiple validator LLMs must agree on the verdict.
            {txHash && (
              <>
                {" "}
                <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer">
                  Track this transaction ↗
                </a>
              </>
            )}
          </div>
        )}
        {error && <div className="banner error">{error}</div>}
      </section>

      {latest && <FeatureCard a={latest} />}

      <ExplainerSections />

      <section className="list">
        <div className="list-head">
          <h2>Past analyses</h2>
          <button className="ghost" onClick={refresh}>Refresh</button>
        </div>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty">No analyses yet. Paste a URL above to start.</div>
        ) : (
          items.slice().reverse().map((a) => (
            <Row
              key={a.analysis_id}
              a={a}
              onSelect={() => {
                setLatest(a);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ))
        )}
      </section>

      <SubmitSection />

      <footer className="foot">
        <div className="foot-row">
          <div>
            <strong>ReviewGuard</strong> · Intelligent Contract on{" "}
            <a href={explorerAddressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
              GenLayer studionet
            </a>
          </div>
          <div className="foot-links">
            <a href="https://github.com/phu1271997/reviewguard" target="_blank" rel="noreferrer">GitHub</a>
            <a href={explorerAddressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Contract on Explorer</a>
            <a href="https://docs.genlayer.com/" target="_blank" rel="noreferrer">GenLayer docs</a>
          </div>
        </div>
        <div className="foot-fine">
          Contract address: <code>{CONTRACT_ADDRESS}</code>
        </div>
      </footer>
    </div>
  );
}

function ExplainerSections() {
  return (
    <>
      <section className="explain" id="problem">
        <div className="explain-eyebrow">The problem</div>
        <h2 className="explain-title">Fake reviews shape decisions worth real money.</h2>
        <p className="explain-lede">
          A five-star app, a top-rated restaurant, a "verified" seller — most people
          decide from a scroll of reviews they never questioned. But entire review
          markets are for sale: bot farms, referral bribes, coordinated bursts,
          paid takedowns. There's no neutral judge. The platforms themselves have
          incentives to look clean.
        </p>
        <div className="explain-grid">
          <div className="explain-card">
            <div className="explain-h">Reviews aren't neutral.</div>
            <p>Marketplaces moderate their own reviews. Reviewers get comped. Star ratings mask incentivized language. The signal you're seeing has already been curated.</p>
          </div>
          <div className="explain-card">
            <div className="explain-h">An LLM alone isn't enough.</div>
            <p>You can ask ChatGPT "is this review fake?" and get an answer. But the answer lives on someone's server — the same failure mode as trusting the platform. There's no shared record, no way to point at a specific judgement and say "this was produced by consensus, not by us."</p>
          </div>
          <div className="explain-card">
            <div className="explain-h">A regular smart contract can't help.</div>
            <p>Solidity can't fetch a web page. It can't reason about writing style. Every attempt to bring off-chain judgement on-chain has needed an "oracle" — a middleman you have to trust anyway.</p>
          </div>
        </div>
      </section>

      <section className="explain" id="how-it-works">
        <div className="explain-eyebrow">How it works</div>
        <h2 className="explain-title">One on-chain function reads the page and judges it.</h2>
        <p className="explain-lede">
          ReviewGuard's Intelligent Contract on GenLayer does the whole thing in
          the contract, not on our server. Every step of the pipeline lives
          on-chain and is audited by multiple validators before the result is
          allowed to land.
        </p>
        <ol className="flow">
          <li>
            <span className="flow-num">1</span>
            <div>
              <div className="flow-h">You paste a URL.</div>
              <p>The dApp calls <code>analyze(url)</code> on the contract. If the URL isn't <code>http://</code> or <code>https://</code> the contract rejects the call before touching the network — no wasted gas.</p>
            </div>
          </li>
          <li>
            <span className="flow-num">2</span>
            <div>
              <div className="flow-h">Validators fetch the page on-chain.</div>
              <p>Inside the non-deterministic block, each validator calls <code>gl.nondet.web.render(url)</code> — a real headless browser fetches the page as text. No oracle service. No cached snapshot. It's the page as it looks right now.</p>
            </div>
          </li>
          <li>
            <span className="flow-num">3</span>
            <div>
              <div className="flow-h">An LLM grades authenticity.</div>
              <p>The page text goes into <code>gl.nondet.exec_prompt</code> with a prompt that asks about templated wording, copy-paste praise, review bursts, rating-vs-text mismatch, incentivized language. The LLM returns a verdict (<code>TRUSTWORTHY</code> / <code>MIXED</code> / <code>SUSPICIOUS</code> / <code>UNRESOLVABLE</code>), a 0-100 trust score, and concrete red flags.</p>
            </div>
          </li>
          <li>
            <span className="flow-num">4</span>
            <div>
              <div className="flow-h">Validators agree on meaning, not shape.</div>
              <p>The result is wrapped in <code>gl.eq_principle.prompt_comparative</code>. Validators don't demand byte-identical JSON — they use NLP to confirm they reached the <em>same verdict</em> and a close trust score. Two validators disagreeing on the verdict can't both pass. That's what makes the judgement on-chain and trustless.</p>
            </div>
          </li>
          <li>
            <span className="flow-num">5</span>
            <div>
              <div className="flow-h">The record is written on-chain.</div>
              <p>Verdict, trust score, red flags, and a plain-English summary are stored under a URL cache. The next time anyone queries the same URL, the answer is a free view call. Every past analysis is public and can be verified against the transaction on the GenLayer studionet explorer.</p>
            </div>
          </li>
        </ol>
      </section>
    </>
  );
}

function SubmitSection() {
  return (
    <section className="explain submit" id="how-to-use">
      <div className="explain-eyebrow">How to use it</div>
      <h2 className="explain-title">Try it in one click — or paste any review page you care about.</h2>
      <p className="explain-lede">
        No wallet install. No funds needed. The app creates a throwaway signing
        key in your browser (visible as the "wallet" chip up top). GenLayer
        studionet funds it automatically for demo transactions. Analyses take
        20-90 seconds each because multiple validators independently read the
        page and grade it.
      </p>
      <div className="how-grid">
          <div className="how-step">
            <div className="how-h">1. Use a seeded example</div>
            <p>Scroll to the top and click any of the three "Try:" chips — <em>Trustworthy</em> (Discord), <em>Mixed</em> (Facebook), or <em>Suspicious</em> (Temu). Each already has a verified on-chain record so you get a result fast.</p>
          </div>
          <div className="how-step">
            <div className="how-h">2. Paste your own URL</div>
            <p>Any page starting with <code>https://</code> works. Best results: App Store listings, Wikipedia articles, small e-commerce pages, blog reviews. Pages behind Cloudflare / bot walls (Trustpilot, G2, Yelp) will return <code>UNRESOLVABLE</code> — that's the contract correctly refusing to guess.</p>
          </div>
          <div className="how-step">
            <div className="how-h">3. Watch consensus happen</div>
            <p>While validators work, the loading note gives you a "Track this transaction ↗" link to the studionet explorer. You can watch the tx move from proposed → accepted → finalized in real time.</p>
          </div>
          <div className="how-step">
            <div className="how-h">4. Read the verdict</div>
            <p>The result card shows a colour-coded verdict pill, a trust score gauge (0-100), a plain-English summary of the judgement, and a bulleted list of specific red flags the LLM found. Everything visible was produced by validator consensus — not by our server.</p>
          </div>
          <div className="how-step">
            <div className="how-h">5. Come back for the history</div>
            <p>Past analyses are always visible below, newest first. Clicking a row expands it. Clicking the contract chip in the header opens the address on the studionet explorer where you can see every <code>analyze</code> transaction the contract has ever executed.</p>
          </div>
          <div className="how-step">
            <div className="how-h">Something not working?</div>
            <p>If a tx hangs more than two minutes, click "Refresh" in Past analyses — it often finalized without the browser noticing. If the wallet ever runs out, clear your <code>localStorage</code> and reload to mint a new burner.</p>
          </div>
      </div>
    </section>
  );
}

function Gauge({ score, color }) {
  // circular trust gauge, 0..100
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  return (
    <svg className="gauge" viewBox="0 0 120 120" width="120" height="120" aria-hidden>
      <circle cx="60" cy="60" r={r} className="gauge-track" />
      <circle
        cx="60" cy="60" r={r}
        className="gauge-fill"
        style={{ stroke: color, strokeDasharray: `${dash} ${c}` }}
      />
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
          <span className="verdict-pill" style={{ background: meta.color }}>
            {meta.label}
          </span>
          <a className="feature-url" href={a.url} target="_blank" rel="noreferrer">
            {a.url} ↗
          </a>
          {a.summary && <p className="feature-summary">{a.summary}</p>}
        </div>
      </div>
      {flags.length > 0 && (
        <div className="flags">
          <div className="flags-label">Red flags</div>
          <ul>
            {flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
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
      <button className="row-head" onClick={() => {
        onSelect();
        setOpen(!open);
      }}>
        <span className="score-chip" style={{ color: meta.color }}>
          {a.trust_score}
        </span>
        <span className="row-verdict" style={{ color: meta.color }}>{meta.label}</span>
        <span className="row-url">{a.url}</span>
        <span className="row-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="row-body">
          {a.summary && <p>{a.summary}</p>}
          {flags.length > 0 && (
            <ul>{flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
          )}
          <a href={a.url} target="_blank" rel="noreferrer">Open page ↗</a>
        </div>
      )}
    </article>
  );
}
