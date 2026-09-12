# Devpost submission — paste-ready

Every field the submission form asks for, in order. Nothing here claims anything
the code does not do; the verification commands are in the last section.

---

## Project name

**Anchrion**

## Tagline (max ~200 chars)

> Find every permission your wallet granted, see which one drained it, and revoke
> the whole attacker family. Paste any address — no wallet, no signup, no API keys.

## Inspiration

Prevention in crypto wallets has genuinely been solved. Wallet-drainer phishing
losses fell **83% in 2025** — $494M in 2024 to $83.85M — because Rabby, MetaMask
(which acquired Wallet Guard), Blockaid and Revoke.cash now simulate what you are
about to sign and list what you have approved.

But every one of those tools is preventive or inventory-based. Not one of them
answers the question a person has *after* funds leave: which permission was used,
who used it, and can the same party still reach me? Today that gets answered in a
Telegram group by pasting a transaction hash and guessing — while the same user is
one search away from a phishing clone of a revoke tool.

So we built the half nobody builds.

## What it does

**1. Discovery that a watchlist cannot do.** Anchrion decodes
`approve`/`increaseAllowance` calls from the wallet's own transaction history, adds
every contract the wallet has ever called as a spender candidate, folds in ERC-20
`Approval` events for tokens the wallet has touched, and then reads
`allowance(owner, spender)` live from each token contract. The live read is the
only authoritative answer, and a permission to a contract on no list anywhere
still appears.

**2. A published risk model.** Transparent rules, documented on `/method`, in
which every factor is tagged `detected` (read from chain or explorer) or
`estimated` (derived). A signal that could not be measured adds nothing and is
rendered as *not measured* — never as safe. There is no bundled threat feed, and
we do not pretend to have one.

**3. Real revoke.** `approve(spender, 0)` signed by the user's own wallet, one row
or a batch, with signing / pending / confirmed states, an explorer link per
transaction, and a rescan from chain after the receipt lands.

**4. Incident reconstruction — the part that does not exist elsewhere.** Given an
address, Anchrion finds token transfers **out** of it inside transactions the
wallet did not send (funds only leave that way when a *permission* is used, not a
key), resolves the sender of each, matches that sender against the live
permissions, and groups every remaining permission sharing a **deployer** with the
attacker — then offers to revoke the whole family at once. Every line links to a
transaction the user can open.

**5. Read-only inspection.** Any address can be inspected with no wallet
connected. This is how the project is meant to be evaluated: paste an address and
see real results in seconds. Revoking is enabled only when the connected wallet is
that address on that network, and the button says so when it is not.

## How we built it

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, wagmi + viem,
Tailwind v4, TanStack Query.

**Networks:** Sepolia (default), Ethereum, Base, Arbitrum One, Optimism.

Most of the engineering went into a constraint we set ourselves: **the project
must run from a fresh clone with zero API keys and zero signup.** That forced
three findings worth reporting.

**Public RPC endpoints cap `eth_getLogs` at roughly 100 blocks.** Measured on
2026-09-12 with an owner-filtered USDC query: `ethereum-rpc.publicnode.com`
answers 100 blocks and refuses 300 with *"Archive requests require a personal
token"*; `eth.drpc.org` answers 100 and refuses 300; `1rpc.io/eth` refuses both.
So the reachable window is **probed at scan time** and reported per scan rather
than hardcoded — and a run with no reachable endpoint reports approval-event
coverage as *unmeasured*, never as "no approvals".

**Tenderly's public gateway answers the same query at 2,000,000 blocks.** That is
what makes finding a years-old approval possible with no key and no indexer, so it
is the first endpoint for every supported chain. Every endpoint in the list was
probed for `eth_blockNumber`, `eth_call` and `eth_getLogs` before being added;
endpoints that now require a personal token, refuse `eth_call`, or silently
truncate wide queries were deliberately left out.

**The `Approval` event topic hash in our first build was wrong by one character.**
`0x8c5be1e5…c3b921` instead of the real `0x8c5be1e5…c3b925`, which is why
log-based discovery had never returned anything. We found it by hashing the
signature ourselves and comparing against live logs — not by reading our own
constant and trusting it.

## Challenges we ran into

- **The honesty problem.** The first version of this project claimed
  integrations it did not have (0G, Hedera, The Graph) and had a "Revoke" button
  with no `onClick`. Both were deleted and rebuilt rather than dressed up. The
  commits are honest about that.
- **Refusing to report "nothing" when we meant "unmeasured."** Most tooling
  collapses those two, and that collapse is exactly what makes someone trust a
  clean dashboard after a drain. We rebuilt the data model so `null` is a real
  state that flows from the RPC layer to the pixels, and added a coverage panel
  that prints what the scan could *not* see. Distinguishing *granted then revoked*
  from *candidate never granted* is part of the same discipline.
- **Making a security tool judgeable in 20 seconds** without asking a reviewer to
  install a wallet, which is why read-only inspection exists.

## What we are proud of

An ordinary scam scanner tells you it found nothing. Anchrion tells you **what it
looked at**, **what it could not look at**, and **which single permission is the
one to revoke first** — and it answers the question that has no product
immediately before it: what did the attacker actually do to me.

## What we learned

That the interesting work in this category is not detection anymore. Detection is
a solved, billion-dollar, well-funded problem. The unexplored surface is *after the
fact*: explaining an incident from public data, and being precise about the edges
of what you can see.

## What's next

- **ERC-721 / ERC-1155 approvals and Permit2 / ERC-2612 permits.** The coverage
  note states plainly that these are not covered today. Off-chain permits are
  where a large share of the remaining drainer volume went.
- **Shareable reconstruction links**, so a victim can post a link in a support
  thread instead of describing the situation.
- **Warn before the second drain.** If a deployer is already known to have drained
  someone, that is a detectable signal before the next victim signs.

## Built with

`next.js` · `react` · `typescript` · `tailwindcss` · `wagmi` · `viem` ·
`tanstack-query` · `solidity` · `ethereum` · `base` · `arbitrum` · `optimism` ·
`sepolia`

## Links

- **Live app:** <https://anchrion.sithunyein.com/dashboard>
- **Repository:** <https://github.com/thesithunyein/anchrion>
- **Risk model / method:** <https://anchrion.sithunyein.com/method>

## Verification (run it yourself)

```bash
git clone https://github.com/thesithunyein/anchrion && cd anchrion
npm install && cp .env.example .env.local && npm run dev

npx tsc --noEmit     # clean
npx eslint .         # 0 problems
npm run build        # all routes build

# print the coverage report and every discovered permission, with its source
./scripts/verify-discovery.sh 0xYourAddress 1
```

A real mainnet wallet, scanned through the public API — the numbers below are the
actual coverage report, not an illustration:

```
COVERAGE
  transactions read ............ 13
  token transfers read ......... 16
  approve() calls decoded ...... 6
  Approval events decoded ...... 3
  tokens scanned ............... 8
  pairs read on chain .......... 208
  granted then revoked ......... 6
  candidate never granted ...... 200
  log window reached ........... 2000000 blocks
  explorer reachable ........... true
  prices ....................... live

LIVE PERMISSIONS: 2
  risk level   token   allowance   value    via            spender
  40   medium  USDC    Unlimited   $9999    approval-log   0xd8b444ac…
  40   medium  USDC    Unlimited   $9999    approval-log   GPv2VaultRelayer
```

The first row is the point of the project: **an unlimited USDC allowance to a
contract with no label, found because it came out of that wallet's history.**

## Reproducing the incident demo

`contracts/DemoDrainer.sol` is a **testnet-only** drainer with a labelled operator,
and `scripts/stage-drain.sh` refuses to run on any chain other than Sepolia. It
exists so the reconstruction can be demonstrated on a real, verifiable incident by
anyone who clones the repo. Anchrion never deploys or calls it.

## Honest disclosure

AI coding assistants were used to build this project. The author directed,
reviewed, and verified the result: architecture, discovery strategy, risk model,
and every decision about what to claim and what to delete were the author's, and
the build, typecheck, lint and on-chain tests above were run and read by the
author. We removed the features and claims that did not hold up, and this section
exists because "how was this built" is a fair question that deserves a real answer.
