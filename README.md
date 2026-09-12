<div align="center">
  <img src="public/logo.png" alt="Anchrion" width="100" />

  # Anchrion

  **Find every permission your wallet granted. See how a drain actually happened.**

  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
  [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
  [![No API keys required](https://img.shields.io/badge/API%20keys-not%20required-success)](.env.example)
</div>

---

## The problem

Every crypto wallet accumulates token permissions. You grant them to a swap, a mint, a
staking pool — and then they stay open forever. Most people have no idea how many are
still live, or which ones can reach their whole balance.

Detection has genuinely improved: drainer-phishing losses fell **83%, from $494M in 2024
to ~$84M in 2025**. What has *not* improved is the hour after someone is drained. At that
point you cannot see:

- which permission was used,
- who used it,
- which of your remaining permissions that same address can still reach.

Existing tools are all preventive. **Rabby**, **MetaMask** (which acquired Wallet Guard in
2024), and **Revoke.cash** warn you before you sign, or list what you have. None of them
reconstruct what already happened. And searching for "revoke my approval" after a scare
now regularly lands people on phishing clones that look like revoke tools and instead
grant the attacker an approval.

Anchrion does both halves, and is explicit about which is which.

## What it does

**1. Discovery — finds approvals a watchlist cannot.**
Anchrion decodes `approve(address,uint256)` and `increaseAllowance` calls out of your own
transaction history, adds every contract your wallet has ever called as a spender
candidate, folds in ERC-20 `Approval` events for tokens you have touched, and then reads
`allowance(owner, spender)` live from each token contract — the only authoritative answer.
Nothing gates discovery behind a known-spender list: a permission to a contract nobody has
heard of appears if your history or the token's events reach it, and a bundled list of
major routers is only ever an *addition* to that.

**1b. Read-only inspection.** Any address can be scanned without connecting a wallet. This
is how the project is meant to be evaluated: paste an address and see real findings in
seconds. Revoking is only enabled when the connected wallet is that same address on that
same network, and the button says so when it is not.

**2. Honest scoring.** A transparent, published rule set — not a threat feed, not a
trained model. Every factor is tagged `detected` (read from chain or explorer) or
`estimated` (derived). Unmeasured signals add nothing and are displayed as *not measured*,
never as safe. The full weights and the model's blind spots are on `/method`.

**3. Real revoke.** One click, or batch. `approve(spender, 0)` through your wallet, with
pending/confirmed states, an explorer link per transaction, and a rescan from chain
afterwards so the list reflects reality rather than optimism.

**4. Incident reconstruction — the part nobody else builds.** Given a wallet, Anchrion
finds token transfers out of it inside transactions the wallet did **not** send (funds only
leave that way when a permission is used), resolves the sender of each one, matches it
against the live permissions, and groups every remaining permission that shares a deployer
with the attacker. Then it offers to revoke the whole family at once. Every line of the
reconstruction links to a transaction you can open yourself.

## Quick start

No API keys required. Public RPC endpoints, keyless Blockscout explorer endpoints, and
keyless CoinGecko prices.

```bash
git clone https://github.com/thesithunyein/anchrion.git
cd anchrion
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000> for the landing page, or
<http://localhost:3000/dashboard> for the app. Everything in `.env.example` is optional;
keys only raise rate limits.

Supported networks: **Sepolia** (default, for demos), Ethereum, Base, Arbitrum One,
Optimism.

## Architecture

```
src/
  app/
    api/approvals/route.ts    POST { walletAddress, chainId } → permissions + coverage
    api/incident/route.ts     POST { walletAddress, chainId } → reconstructed incident
    dashboard/page.tsx        the app: scan, explain, revoke, reconstruct
    method/page.tsx           published risk model, weights, and limits
  components/
    approval-row.tsx          one permission: evidence, signals, revoke, explorer links
    incident-panel.tsx        the reconstruction: narrative, transfers, family revoke
  lib/
    approvals/scan.ts         discovery engine (history + logs + live allowance reads)
    approvals/client.ts       browser client + honest local observation history
    incident/reconstruct.ts   post-drain reconstruction and attacker-family grouping
    risk/scorer.ts            the published scoring model
    abi/erc20.ts              minimal ERC-20 surface + approval-selector decoding
    chain/rpc.ts              JSON-RPC with endpoint failover
    explorer/blockscout.ts    keyless explorer client (history, verification, age)
    prices.ts                 live USD prices with a dated static fallback
    hooks/use-revoke.ts       revoke + sequential batch revoke with per-row status
contracts/DemoDrainer.sol     TESTNET-ONLY drainer used to stage a reproducible incident
scripts/stage-drain.sh        stages that incident on Sepolia
```

### How a scan flows

1. Read the wallet's token transfers and transactions from the explorer.
2. Decode `approve` / `increaseAllowance` calldata → `(token, spender)` candidates, and
   take every contract the wallet has called as further spender candidates.
3. **Probe** the RPC endpoint for the widest `eth_getLogs` window it will actually answer
   (see "Log windows are measured" below), then read `Approval` events for each token the
   wallet has touched.
4. Build the candidate cross-product (tokens × spenders) and ask each token contract for the
   **live** allowance. That read is the truth: a pair proved to have existed and now at zero
   is counted as *granted then revoked*, which is different from a candidate that was never
   granted — the coverage panel reports both numbers separately.
5. Enrich each spender: bytecode present, source verified, contract name, deployer,
   deployment age, explorer scam flag — each of which can come back *unknown*.
6. Score, sort, and return a **coverage report** describing exactly what was inspected.

### Log windows are measured, not assumed

Keyless public RPC nodes increasingly treat a wide `eth_getLogs` range as an archive query
and refuse it. Measured on 2026-09-12 with an owner-filtered USDC query:

| Endpoint | 100 blocks | 300 blocks |
|---|---|---|
| `ethereum-rpc.publicnode.com` | answered | refused ("archive requests require a personal token") |
| `eth.drpc.org` | answered | refused |
| `1rpc.io/eth` | refused | refused |
| `gateway.tenderly.co/public/mainnet` | answered | answered |

So the endpoint that can serve approval history is used first, and the reachable window is
**probed at scan time** rather than hardcoded. A deployment with its own archive node can
pin it with `NEXT_PUBLIC_LOG_WINDOW_BLOCKS`.

**And a wider window is not automatically a better one.** Tenderly answers wide ranges
*without error* while returning a fraction of the events, which is worse than refusing,
because inventing a coverage number is how a security tool lies. Measured with an
owner-filtered USDC query on one busy approver:

| Window | Rows returned |
|---|---|
| 5,000 blocks | **12,530** |
| 50,000 blocks | 70 |
| 2,000,000 blocks | 70 |

A light wallet returns identical rows at every window and looks fine. So completeness is
checked **per token**, not once: every token's wide read is compared against a 2,000-block
read, the wide read is discarded if it is missing anything the narrow one contained, and
the coverage panel reports the narrowest window actually used. On the wallet above the
scan now reports `Log window: 2,000 blocks (wider ranges rejected as incomplete)` instead
of an invented 2,000,000.

## The risk model

Weights are published on `/method` and in `src/lib/risk/scorer.ts`. Summary:

| Signal | Points | Evidence |
|---|---|---|
| Unlimited permission (≥ 2^255) | +30 | detected |
| Spender has no contract code | +40 | detected |
| Explorer flags the spender as a scam address | +45 | detected |
| Unverified contract source | +20 | detected |
| Deployed < 7 / 30 / 90 days ago | +25 / +15 / +5 | detected |
| Address on your own `NEXT_PUBLIC_THREAT_LIST` | +50 | detected |
| Value at risk > $10k / > $1k | +15 / +10 | estimated |
| Unlimited and idle > 365 days | +10 | estimated |
| Recognised protocol on the bundled allowlist | −20 | detected |

Bands: critical ≥ 70, high ≥ 50, medium ≥ 30, low ≥ 10, otherwise safe. There is **no
bundled threat feed** — Anchrion will not pretend to know an address is malicious unless
you supply the list.

## Reproducing an incident

The reconstruction is only convincing if you can stage the incident yourself.

```bash
export DEPLOYER_KEY=0x...      # funded Sepolia key, throwaway
export VICTIM_ADDRESS=0x...    # a second throwaway wallet that holds a Sepolia token
export TOKEN=0x...             # an ERC-20 the victim holds on Sepolia
./scripts/stage-drain.sh       # refuses to run on any chain other than Sepolia
```

It deploys `contracts/DemoDrainer.sol`, prints the approval command to run from the victim
wallet, then drains it. Connect the victim wallet in Anchrion and run the reconstruction.

**This is a simulation harness on a testnet, and the UI never presents it as a live
victim.** Do not deploy that contract anywhere with real value.

## Limits — what Anchrion does not do

- **ERC-20 allowance approvals only.** ERC-721 (NFT) approvals and off-chain permits
  (Permit2, ERC-2612) are not covered.
- **Approvals granted inside a contract call** are limited by whatever log window the
  configured RPC endpoint will answer. That window is probed and reported per scan; there is
  no keyless guarantee of full history, and the scan says so instead of implying completeness.
  A run with no reachable endpoint reports approval-event coverage as *unmeasured*, never as
  "no approvals".
- **Walks recent history, not all of it.** A wallet with thousands of approvals will not
  have every one enumerated in a single scan.
- **Spender enrichment is capped** per scan to stay inside public rate limits; the cap is
  reported in the coverage panel.
- **Unknown is not safe.** Where a signal could not be measured it is shown as not
  measured, and the model adds nothing for it.
- **Never custody.** Anchrion uses view calls and your wallet's own signing prompts. It
  never asks for a private key, never signs on your behalf, and cannot move funds. Your
  scan history lives in your browser's `localStorage`, not in a database we run.

## Verification

```bash
npx tsc --noEmit   # clean
npx eslint .       # 0 errors
npm run build      # builds all routes
```

Measured on real mainnet data (2026-09-12) — the numbers below are the actual coverage
report for an active wallet, reproduced by `POST /api/approvals`:

```
208 candidate permissions read on chain
  5 granted then revoked (proved by an approve() call or an Approval event)
201 candidate pairs never granted
  2 live permissions found, both unlimited USDC, both via Approval events
  log window verified complete: 200,000 blocks
```

A scan against a wallet holding a permission granted to a contract that is **not** on any
bundled list is the test that matters. The verification script for that is
`scripts/verify-discovery.sh`, and it prints the spender and the discovery source.

## AI tooling disclosure

AI coding assistants were used to build this project, and the project's own author
directed, reviewed, and verified the result. Specifically: the assistant was used for
implementation scaffolding, refactors, and documentation drafts; the architecture,
discovery strategy, risk model, and all decisions about what to claim and what to delete
were made by the author, who reviewed every file and ran the build, typecheck, lint, and
on-chain tests above. This disclosure is here because claiming otherwise would be
inaccurate, and because "how did you build this" is a question worth answering honestly.

## The 20-second test

Open the dashboard, paste any address, press **Inspect**. No wallet install, no
signup, no API key. You get live permissions, the value reachable through each one,
and a coverage panel naming what the scan could not see. Revoking is enabled only
when the connected wallet owns that address on that network.

If you want one command instead of a browser:

```bash
./scripts/verify-discovery.sh 0xYourAddress 1
```

## Deployment note

The landing page is a static file at `public/index.html`, served at `/` by the
rewrite in `next.config.ts`. A hosting platform that already has a stale build will
keep serving the old app until it is redeployed, so after pulling changes, rebuild
and redeploy before pointing anyone at the live URL — `/method` and the read-only
inspection flow on `/dashboard` only exist in the current build.

## License

MIT — see [LICENSE](LICENSE).

<div align="center">
  <p>Built by <a href="https://github.com/thesithunyein">Sithu Nyein</a></p>
</div>
