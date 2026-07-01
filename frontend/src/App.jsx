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
} from "./genlayer.js";
import "./styles.css";

const VERDICT_META = {
  TRUSTWORTHY: { color: "var(--good)", label: "Trustworthy" },
  MIXED: { color: "var(--warn)", label: "Mixed signals" },
  SUSPICIOUS: { color: "var(--bad)", label: "Suspicious" },
  UNRESOLVABLE: { color: "var(--muted)", label: "Unresolvable" },
};

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
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Failed to read analyses:", e);
      setError("Could not read analyses: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function onAnalyze() {
    const target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      setError("Enter a full URL starting with http:// or https://");
      return;
    }
    setError("");
    setBusy(true);
    setLatest(null);
    try {
      await analyze(target);
      // fetch the fresh analysis for this URL to feature it
      const found = await findByUrl(target);
      setLatest(found);
      setUrl("");
      await refresh();
    } catch (e) {
      setError("Analysis failed: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
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
          <span className="mark">RG</span> ReviewGuard
        </div>
        <p className="tag">
          Paste any review page — a place, a product, a listing. The contract
          reads it on-chain and an LLM grades how authentic the reviews look:
          bot patterns, copy-paste praise, suspicious bursts. The judgement lives
          on-chain, not on our server.
        </p>
        <div className="you">you: <code>{short(me)}</code></div>
      </header>

      <section className="panel">
        <label className="field">
          Review page URL
          <div className="input-row">
            <input
              placeholder="https://www.google.com/maps/place/…  or  a product page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) onAnalyze(); }}
            />
            <button className="primary" disabled={busy} onClick={onAnalyze}>
              {busy ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </label>
        {busy && (
          <div className="consensus">
            Reading the page on-chain and reaching validator consensus. This
            usually takes 5–30 seconds — the LLM analysis is running across
            multiple validators.
          </div>
        )}
        {error && <div className="banner error">{error}</div>}
      </section>

      {latest && <FeatureCard a={latest} />}

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
          items.slice().reverse().map((a) => <Row key={a.analysis_id} a={a} />)
        )}
      </section>

      <footer className="foot">
        Judgement performed by an Intelligent Contract on GenLayer ·{" "}
        <code>{short(CONTRACT_ADDRESS)}</code>
      </footer>
    </div>
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

function Row({ a }) {
  const meta = VERDICT_META[a.verdict] || VERDICT_META.UNRESOLVABLE;
  const [open, setOpen] = useState(false);
  const flags = Array.isArray(a.red_flags) ? a.red_flags.filter(Boolean) : [];
  return (
    <article className="row" style={{ "--vc": meta.color }}>
      <button className="row-head" onClick={() => setOpen(!open)}>
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
