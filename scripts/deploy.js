#!/usr/bin/env node
// scripts/deploy.js
// Optional scripted deploy for ReviewGuard (the recommended path is the Studio
// UI — see README). Deploys contracts/ReviewGuard.py to studionet and prints
// the address to paste into frontend/.env as VITE_CONTRACT_ADDRESS.
//
// Usage:
//   GENLAYER_PRIVATE_KEY=0x... node scripts/deploy.js

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
    console.log("  (fund it on the Studio faucet before deploying for real)\n");
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
