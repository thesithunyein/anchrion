<div align="center">
  <img src="public/logo.png" alt="Anchrion" width="100" />

  # Anchrion

  **See how a drain happened. Find every permission your wallet granted.**

  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
  [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
  [![No API keys required](https://img.shields.io/badge/API%20keys-not%20required-success)](.env.example)
</div>

---

## The problem

A drain takes a few seconds. What follows takes hours, and nobody helps with it.

The wallet is empty. The transaction that emptied it is not one you signed, which means no key
was stolen: a permission you granted once was used to move your tokens. You have eleven
permissions left, three of them unlimited, and no way to tell which one did it or whether the
same address can still reach the rest.

The tools that exist are preventive, or inventory-shaped:

- **Rabby** simulates a transaction before you sign it and shows the balance change.
- **MetaMask** acquired Wallet Guard and now warns about drainers before you sign.
- **Revoke.cash** lists every on-chain permission you hold and revokes any of them.

All three are good at what they do, and each one acts before the loss or shows you what is
still open. None of them tells you what happened to you.

The numbers say that gap is widening, not closing. Wallet-drainer phishing losses fell **83%,
from $494M in 2024 to $83.85M in 2025** (Scam Sniffer). Over roughly the same period
Chainalysis recorded personal wallet theft incidents rising to about **158,000 in 2025 from
54,000 in 2022**, while the total taken from individuals fell from a **$1.5B peak to $713M**.
Fewer dollars, more victims. The average loss is now under a thousand dollars, which is
precisely why no company builds the tool for the person it happened to.

So that person follows the search results, and the search results are thin. "Revoke approvals",
without naming which one. Worse, searching to revoke an approval now regularly lands people on
phishing clones of revoke tools that grant the attacker a fresh permission instead.

Two honest limits belong in this section, not in a footnote. First, nothing here recovers
stolen funds, because nothing can, and anyone promising that is running a second scam. What is
possible is stopping the rest. Second, a clean dashboard is not a clean bill of health: permit
signatures (ERC-2612, Permit2) are off-chain, so no approval checker can see them, including
this one. Anchrion says so on every scan rather than implying otherwise.

Anchrion covers both halves, and is explicit about which half is which.

## What it does

**1. Incident reconstruction.** Given an address, Anchrion finds token transfers out of it
inside transactions the wallet did **not** send (funds only leave that way when a permission
is used), resolves the sender of each one, matches it against the live permissions, and
groups every remaining permission that shares a deployer with the attacker. Then it offers to
revoke the whole family at once. Every line of the reconstruction links to a transaction you
can open yourself.

**2. Discovery — finds approvals a watchlist cannot.**
Anchrion decodes `approve(address,uint256)` and `increaseAllowance` calls out of your own
transaction history, adds every contract your wallet has ever called as a spender
candidate, folds in ERC-20 `Approval` events for tokens you have touched, and then reads
`allowance(owner, spender)` live from each token contract — the only authoritative answer.
Nothing gates discovery behind a known-spender list: a permission to a contract nobody has
heard of appears if your history or the token's events reach it, and a bundled list of
major routers is only ever an *addition* to that.

That bundled list is **measured, not assumed**. Every router in it was checked with
`eth_getCode` on all five supported chains, and is only used as a seed on a chain where it
has bytecode, with reserved slots so a busy wallet's history cannot silently evict it. One
address previously in the list (`0x3bfa4769fb075c4a5fb0ec02e73249f2c16438b3`, labelled
"Uniswap V3 Router (Sepolia)") returns `0x` on every chain — it has no code anywhere, and
was the only bundled entry the old chain filter allowed on Sepolia. It is gone, replaced by
the real Sepolia SwapRouter02, and an audit script now checks that this class of claim
reproduces (see *Verifying the coverage panel* below).

**3. Read-only inspection.** Any address can be scanned without connecting a wallet. This
is how the project is meant to be evaluated: paste an address and see real findings in
seconds. Revoking is only enabled when the connected wallet is that same address on that
same network, and the button says so when it is not.

**4. Honest scoring.** A transparent, published rule set — not a threat feed, not a
trained model. Every factor is tagged `detected` (read from chain or explorer) or
`estimated` (derived). Unmeasured signals add nothing and are displayed as *not measured*,
never as safe. The full weights and the model's blind spots are on `/method`.

**5. Real revoke.** One click, or batch. `approve(spender, 0)` through your wallet, with
pending/confirmed states, an explorer link per transaction, and a rescan from chain
afterwards so the list reflects reality rather than optimism.

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
| Capped value at risk ≥ $10k / ≥ $1k | +15 / +10 | estimated |
| Unlimited and idle > 365 days | +10 | estimated |
| Recognised protocol on the bundled allowlist | −20 | detected |

Every dollar figure is a measurement, not a placeholder: exposure is the smaller of the
live allowance and the wallet's live balance of that token, priced at the current (or a
dated snapshot) USD rate. Where either read fails, no figure is quoted at all and the row
says so. An unlimited permission is never scored on its dollar figure — unlimited is
already a weight of its own, and its reachable amount is today's balance rather than what
the permission permits. The −20 protocol discount requires an **address** match against
the bundled list, because the contract name an explorer reports is chosen by whoever
deployed it and must never move a score.

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
npm run typecheck   # tsc --noEmit, clean
npm run lint        # eslint, 0 problems
npm run build       # builds all routes
npm run verify      # recomputes a scan's coverage numbers, independently
```

Measured on real mainnet data on 2026-09-12 against one high-frequency address
(`0x4d146413c0dd1794019f9adee8d28304d0afee05`), read straight off `npm run verify`. The
first four rows are the app's own numbers next to numbers derived independently from the
explorer and the RPC endpoint:

```
transactions read            29   (app)    29   (independent)
token transfers read         250  (app)    250  (independent)
approve() calls decoded      0    (app)    0    (independent)
pairs checked accounted for  75   (app)    75   (independent)
probe token rows over 2,000 blocks     1,882
probe token rows over 200,000 blocks   30   <- silently truncated by the endpoint
log window reported                    2,000 blocks (wider ranges rejected as incomplete)
```

That last group is the reason the window is probed rather than assumed. A wider range that
returns 30 rows where a narrow one returns 1,882 is not coverage, and reporting it as the
window reached would have overstated what the scan saw by two orders of magnitude.

A scan against a wallet holding a permission granted to a contract that is **not** on any
bundled list is the test that matters. The verification script for that is
`npm run verify:discovery -- 0xYourAddress`, and it prints the spender and the discovery
source.

## Verifying the coverage panel

The coverage panel is the most load-bearing claim here, so it is auditable rather than
trustworthy on sight:

```bash
npm run verify -- 0xYourAddress [chainId] [baseUrl]
```

It re-derives the panel's numbers from the raw sources — the block explorer and the RPC
endpoint — without importing a line of Anchrion's own code, and prints both columns side by
side: transactions read, token transfers read, `approve()` calls decoded, whether the
displayed log window really subsumes a narrower read, and whether the panel's buckets add
up to the pairs it says it checked. Differences caused by declared budgets are labelled
rather than hidden.

Both behaviours are exercised on real data: an ordinary wallet reports a 200,000-block
window that verifiably contains the 2,000-block read, and a high-frequency wallet reports a
2,000-block window with *wider ranges rejected*, because a 200,000-block read returns 30
rows where 2,000 blocks return 1,880 — the endpoint truncating silently, which is exactly
the failure that makes an unverified window worse than a small one.

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

Every scan is also a link. The address, network and view are written into the URL as you
go, so `/dashboard?address=0x…&chain=11155111&view=incident` opens straight onto that
wallet's reconstruction and starts the scan on load — which is how a finding is meant to be
handed to somebody else.

If you want one command instead of a browser:

```bash
./scripts/verify-discovery.sh 0xYourAddress 1
```

## Routes

Two static pages live in `public/` alongside the Next.js app, and the rewrites in
`next.config.ts` are what connect them. The map is:

| Path | Serves | Source |
|---|---|---|
| `/` | the project landing page | `public/anchrion.html` |
| `/dashboard` | the app — paste an address, revoke, reconstruct an incident | `src/app/dashboard` |
| `/method` | the published risk model and its limits | `src/app/method` |
| `/anchrion`, `/index.html` | aliases for `/` | — |
| `/chestly` | a separate design study, shares no code with Anchrion | `public/chestly/index.html` |

Two wrinkles worth knowing before you change this:

1. Next.js serves files in `public/` by exact path and will **not** resolve a
   folder's `index.html`, which is why `/chestly` needs its own rewrite.
2. Vercel serves `public/index.html` at `/` by itself, and that beats any Next
   rewrite — which is why the landing is `public/anchrion.html` with the root
   mapped explicitly. Rename it back and the platform takes the root over again.

The route that matters to a reviewer is `/dashboard`; if a hosting platform has a
stale build it will keep serving the old app until it is redeployed, so rebuild and
redeploy after pulling changes.

## License

MIT — see [LICENSE](LICENSE).

<div align="center">
  <p>Built by <a href="https://github.com/thesithunyein">Sithu Nyein</a></p>
</div>
