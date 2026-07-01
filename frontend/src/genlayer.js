// src/genlayer.js
// Wrapper around genlayer-js for talking to the deployed ReviewGuard contract.
// The contract address comes from VITE_CONTRACT_ADDRESS (set after you deploy on
// Studio). Antigravity injects this into the Vercel environment.

import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

let _client = null;
let _account = null;

export function getAccount() {
  if (!_account) {
    let stored = localStorage.getItem("rg_pk");
    if (!stored || stored === "undefined" || stored.length < 10) {
      stored = generatePrivateKey();
      try {
        localStorage.setItem("rg_pk", stored);
      } catch (_) {}
    }
    _account = createAccount(stored);
  }
  return _account;
}

export function getClient() {
  if (!_client) {
    // studionet already targets https://studio.genlayer.com/api by default.
    _client = createClient({
      chain: studionet,
      account: getAccount(),
    });
  }
  return _client;
}

function parseJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

// ── Reads (view methods; no gas, instant) ────────────────────────────────────
export async function listAnalyses() {
  const res = await getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_analyses",
    args: [],
  });
  return parseJSON(res, []);
}

export async function getAnalysis(id) {
  const res = await getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_analysis",
    args: [id],
  });
  return parseJSON(res, null);
}

export async function findByUrl(url) {
  const res = await getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "find_by_url",
    args: [url],
  });
  const obj = parseJSON(res, {});
  return obj && Object.keys(obj).length > 0 ? obj : null;
}

// ── Write (the nondet analysis; takes 5–30s while validators reach consensus) ─
export async function analyze(url) {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "analyze",
    args: [url],
    value: 0n,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: "FINALIZED",
    interval: 5000,
    retries: 60,
  });
  return hash;
}
