# Anchrion — pitch deck

12 slides. Text below is the deck; each slide lists what is on screen so it can be
built in any tool without guesswork.

---

## 1 — Title

**Anchrion**
*Find every permission your wallet granted. See how a drain actually happened.*

Sithu Nyein · [anchrion.sithunyein.com](https://anchrion.sithunyein.com) ·
[github.com/thesithunyein/anchrion](https://github.com/thesithunyein/anchrion)

On screen: the dashboard with a real wallet loaded in read-only mode.

---

## 2 — The problem, in one image

Two wallets side by side. Left: the same wallet right after a drain, balance
zero, eleven approvals still live, none of them explained. Right: the user's
search results, which include a phishing clone of a revoke tool.

On screen: **"Prevention shipped. Explanation didn't."**

---

## 3 — Prevention already won, and that is the point

Wallet-drainer phishing losses fell **83% — $494M (2024) → $83.85M (2025)**,
victims down 68%.

That is Rabby, MetaMask, Blockaid, GoPlus and Revoke.cash doing their jobs.

On screen: the falling-losses chart, then the sentence **"So the open problem is
not 'stop the drain'. It is 'explain the one that happened.'"**

---

## 4 — What nobody answers

| Existing tools answer | Nobody answers |
|---|---|
| Is this signature dangerous? | Which permission was used against me? |
| What do I have approved? | Who used it? |
| Is this address known-bad? | Can the same party still reach me? |

On screen: the table, with the right column highlighted. Caption: *every incumbent
is preventive; the post-incident question has no product.*

---

## 5 — What we built

Anchrion does both halves and is explicit about which is which.

- **Discovery** from your own transaction history, token approval events, and live
  `allowance()` reads — including permissions to contracts that are on no list
  anywhere.
- **A published risk model** — transparent rules, every factor tagged
  `detected` or `estimated`; unmeasured signals add nothing and say so.
- **Real revoke** — `approve(spender, 0)` through your wallet, one click or batch,
  with pending/confirmed states and a rescan from chain afterwards.
- **Incident reconstruction** — the half that does not exist elsewhere.

On screen: four cards, then the dashboard.

---

## 6 — The reconstruction, step by step

The signature move, and it is four facts deep:

1. Find token transfers **out** of the wallet inside transactions the wallet did
   not send. Funds only leave that way when a *permission* was used, not a key.
2. Resolve the sender of each such transaction — that is who exercised it.
3. Match that sender against the wallet's live permissions.
4. Group every remaining permission that **shares a deployer** with the attacker,
   and offer to revoke the whole family at once.

Every line links to a transaction the user can open and check.

On screen: the incident panel with a real reconstruction, addresses truncated,
explorer links visible.

---

## 7 — Honesty is the feature

This is the differentiator a checklist cannot see. Anchrion reports what it could
**not** measure, in the product, next to the result:

- Coverage panel on every scan: transactions read, events decoded, pairs checked,
  **granted-then-revoked vs never-granted** counted separately, log window reached.
- Contract facts that could not be resolved render as *not measured* — never as
  safe, and never as a penalty either.
- **No bundled threat-intel list.** We do not claim to know an address is
  malicious unless the user supplies their own list.
- Read-only mode is real: inspecting an address does not imply you can sign for it,
  and the revoke button says so instead of failing silently.

On screen: the coverage panel with real numbers.

---

## 8 — Engineering that made it real

Discovered by measuring, not assuming:

- Keyless public RPC nodes now **cap `eth_getLogs` at roughly 100 blocks** —
  publicnode and drpc both refuse 300 and return *"archive requests require a
  personal token"*. So the reachable window is **probed at scan time** and reported
  per scan instead of hardcoded into a lie.
- Tenderly's public gateway answers the same owner-filtered query at **2,000,000
  blocks**, so it is used first — that is what makes finding an old approval
  possible with no key and no indexer.
- The Ethereum `Approval` event topic hash in the original build was wrong by one
  character (`…c3b921` vs the real `…c3b925`), which is why log-based discovery had
  never worked. Found by hashing the signature and comparing against live logs.

On screen: the measurement table from the README.

---

## 9 — What is verified, and how

Numbers from a real mainnet wallet, reproduced by `scripts/verify-discovery.sh`:

```
208 candidate permissions read on chain
  6 granted then revoked (proved by an approve() call or an Approval event)
200 candidate pairs never granted
  2 live permissions found — both unlimited USDC, both found via Approval events
  log window reached: 2,000,000 blocks
```

`npx tsc --noEmit` clean · `npx eslint .` 0 problems · `npm run build` builds all
routes.

On screen: the terminal output of the verification script.

---

## 10 — Reproducible incident demo

`contracts/DemoDrainer.sol` is a **testnet-only** drainer with a labelled operator,
so anyone cloning the repo can stage the exact incident the reconstruction is built
for, and watch it get explained. `scripts/stage-drain.sh` refuses to run on any
chain other than Sepolia.

On screen: the drain transaction, then Anchrion naming the drainer as the
initiator of a transfer the victim never sent.

---

## 11 — Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · wagmi + viem · Tailwind v4 ·
TanStack Query · deep-blue design system · **zero API keys required to run**.

Networks: Sepolia (default), Ethereum, Base, Arbitrum One, Optimism.

On screen: the architecture tree from the README.

---

## 12 — What is next, honestly scoped

- **ERC-721 / ERC-1155 and Permit2 / ERC-2612 permits.** Today's coverage note says
  plainly that these are not covered. Off-chain permits are where the remaining
  drainer volume went.
- **A public reconstruction endpoint** so a victim can share a link instead of
  describing their situation in a Discord.
- **Pre-drain warning on the family grouping** — if a deployer is already known to
  have drained someone, that is a detectable signal before the second drain.

On screen: the roadmap, then the URL.

<div align="center">

**anchrion.sithunyein.com** — paste any address, see it in 20 seconds.

</div>
