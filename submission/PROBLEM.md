# Problem statement

**Status of every number below:** sourced, and dated. Nothing here is an estimate
we invented.

## Who has the problem

A person who has used DeFi for a while and cannot answer one question: *what is
this wallet currently allowed to take from me?*

Concretely, the person this is built for is the one in the hour after a drain:

- They clicked a link, approved a token, and later found the balance gone.
- They have ten or eleven permissions still live, several unlimited.
- They do not know which of them was used, who used it, or whether the same
  attacker can still reach them.
- Their search for "how to revoke an approval" has a real chance of landing on a
  clone site that looks like a revoke tool and instead *grants* the attacker an
  approval.

## What the problem is

Prevention has been solved. Response has not.

**Prevention is working, and that is not a complaint.** Wallet-drainer phishing
losses fell **83%, from $494M in 2024 to $83.85M in 2025**, across 106,106 victims
(down 68%) — sourced from Scam Sniffer's 2025 report. That drop is the direct
result of transaction simulation and drainer warnings shipped by **Rabby**,
**MetaMask** (which acquired Wallet Guard in 2024), **Blockaid**, **GoPlus** and
**ScamSniffer**, plus free approval dashboards like **Revoke.cash**.

**The unsolved half is what happens after the money is gone.** Every tool in the
category is preventive or inventory-based:

| Tool | What it answers |
|---|---|
| Transaction simulation (Rabby, MetaMask, Blockaid) | "Is what I am about to sign dangerous?" |
| Approval inventory (Revoke.cash, MetaMask's approvals tab) | "What do I have approved?" |
| Threat intel (GoPlus, ScamSniffer, Blockaid) | "Is this address known-bad?" |

None of them answers: **"Which permission was used against me, and can it still
reach me?"** That question has no product. It gets answered today in a Telegram
group, by pasting a transaction hash into a block explorer and guessing.

There is a second, sharper failure inside that gap. After a scare, users search
for how to revoke. Phishing pages impersonating revoke tools are a documented
attack pattern, and they work because the user is already panicking and has never
seen the real interface.

## Why this is worth building now

Three things became true at once:

1. **The attack class is shrinking, which means the population of people who need
   an after-the-fact explanation is a *recent*-incident population.** The tool is
   useful precisely when prevention failed.
2. **The data needed to reconstruct an incident is entirely public.** Token
   transfers, transaction senders, live allowances. No indexer subscription, no
   API key, no custody. We verified this by rebuilding discovery on keyless
   endpoints only.
3. **Nobody is competing here**, because the incentive for a wallet company is to
   stop the drain, not to explain one that already happened.

## The problem in one sentence

Wallets show you what you are about to sign; nothing shows you what already
happened and what is still exposed — so we built the second half, and did not
pretend to do the first.

## Sources

- Scam Sniffer, *Web3 Phishing Attacks — Wallet Drainers Drain $494 Million*
  (2024 report, Jan 2025) — the $494M figure for 2024.
- Scam Sniffer 2025 report — $83.85M across 106,106 victims, an 83% / 68% fall.
  Widely reported, including [cryptonews.com](https://cryptonews.com/news/wallet-drainer-phishing-losses-fall-to-84m-in-2025-down-83/)
  and catalogued by [OWASP Smart Contract Security data sources](https://scs.owasp.org/sctop10/data-sources/).
- Chainalysis approval-phishing research: cumulative approval-phishing losses in
  the billions since 2021.
- Wallet Guard acquisition by MetaMask, 2024 — simulation moved into the wallet
  itself, which is why "scan and revoke" is no longer an open problem.
