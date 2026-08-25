#!/usr/bin/env node
// scripts/deploy.js
// Optional scripted deploy for ReviewGuard (the recommended path is the Studio
// UI — see README). Deploys contracts/ReviewGuard.py to studionet and prints
// the address to paste into frontend/.env as VITE_CONTRACT_ADDRESS.
//
// Usage:
//   GENLAYER_PRIVATE_KEY=0x... node scripts/deploy.js
//
// Studionet auto-funds burner keys enough for deployment, so a fresh account
// with no GENLAYER_PRIVATE_KEY will usually work for demo purposes. If a write
// fails with "insufficient funds", top up the account from the Studio
// Accounts panel (Studio has no public faucet — testnet does, but studionet
// and testnet are separate networks).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const pk = process.env.GENLAYER_PRIVATE_KEY;
  const account = pk ? createAccount(pk) : createAccount();
  if (!pk) {
    console.log("No GENLAYER_PRIVATE_KEY set — generated a throwaway account:");
    console.log("  address:", account.address);
    console.log("  (studionet auto-funds burners for demo txs; top up from the");
    console.log("   Studio Accounts panel if a write fails with insufficient funds)\n");
  }

  const client = createClient({ chain: studionet, account });

  // Some SDK versions require initializing the consensus contract reference.
  if (typeof client.initializeConsensusSmartContract === "function") {
    try { await client.initializeConsensusSmartContract(); } catch (_) {}
  }

  const code = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "ReviewGuard.py"),
    "utf-8"
  );

  console.log("Deploying ReviewGuard.py to studionet…");
  const hash = await client.deployContract({ code, args: [], leaderOnly: false });
  console.log("deploy tx:", hash);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 5000,
    retries: 60,
  });

  const address =
    receipt?.data?.contract_address ||
    receipt?.contract_address ||
    receipt?.contractAddress;

  console.log("\n✅ Deployed. Contract address:");
  console.log("   " + address);
  console.log("\nPaste into frontend/.env :");
  console.log("   VITE_CONTRACT_ADDRESS=" + address);
}

main().catch((e) => {
  console.error("Deploy failed:", e);
  process.exit(1);
});
