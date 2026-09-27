# Security policy

Anchrion is a read-only wallet permission scanner. It never asks for a private key, cannot
sign on your behalf, and cannot move funds. That does not mean it has no security surface —
the honesty of its findings is itself a safety property, so a wrong number is treated as a
security bug, not a cosmetic one.

## Reporting a vulnerability

Email **sithunyein.mailto@gmail.com**.

Please **do not open a public issue** for anything that could be used against someone
before it is fixed.

Include, as far as you can:

- what you did, and what happened;
- what you expected instead;
- the smallest reproduction you have — a URL, an address and chain, or a failing command;
- whether the issue can mislead a user, not just crash the app.

**What to expect:**

| Stage | Target |
|---|---|
| Acknowledgement | 72 hours |
| Assessment and severity | 7 days |
| Fix or documented mitigation | 30 days for anything that can mislead a user |

You will be credited in the fixing commit if you want to be. If you would rather stay
anonymous, say so and you will.

## Scope

**In scope**

- This repository, including the scan engine (`src/lib/approvals`), the reconstruction
  (`src/lib/incident`), the scoring model (`src/lib/risk`), and the route handlers.
- The deployed application at <https://anchrion.sithunyein.com>.
- Any way to make the tool **overstate safety** — a permission shown as revoked when it is
  live, an unmeasured signal counted as zero in a way the UI does not admit, a coverage
  number that does not match what was actually read, or spend the wrong wallet's approval.
- Any way to make the tool **understate** risk in a manner the coverage panel does not report.

**Out of scope**

- Public RPC providers, block explorers, and price APIs. Anchrion reads from them; a bad
  answer from an upstream service is theirs to fix, though we want to know if Anchrion
  trusts it further than it should.
- Third-party contracts and tokens Anchrion only reads. It holds no privileges over them.
- `contracts/DemoDrainer.sol` and `scripts/stage-drain.sh`. These are a **testnet-only**
  harness for staging a reproducible incident. Running them against a chain with real value
  is misuse, not a vulnerability, and the stage script refuses to run anywhere but Sepolia.
- Findings that require the user to have already been compromised by something else.

## What Anchrion holds

Nothing worth stealing, by design:

- **No private keys or seed phrases.** It never asks, and it cannot sign. Every revoke is a
  transaction your own wallet prompts you for.
- **No server-side database.** Scan history lives in your browser's `localStorage`, not in a
  service we run.
- **No accounts, no third-party API keys of yours.** Every network read uses public RPC and
  keyless explorer endpoints.
- **The only secret is your own.** If you set an RPC or price API key in `.env.local` to
  raise rate limits on your own deployment, it stays in your deployment.

## Design guarantees that must not regress

These are invariants. A change that breaks one is a security regression:

1. **Never ask for a seed phrase or private key**, and never sign anything.
2. **Revoking is enabled only when the connected wallet is that same address on that same
   network.** The interface says so when it is not.
3. **Unmeasured signals add zero and are shown as *not measured*, never as safe.**
4. **No bundled threat feed.** The only threat list is the one a deployment supplies through
   `NEXT_PUBLIC_THREAT_LIST`. The bundled router list is an addition to discovery, never a
   verdict, and the `-20` recognised-protocol discount requires an address match — a name an
   explorer reports must never move a score.
5. **The coverage panel describes what was actually read**, including the log window used and
   the reads that failed.
6. **An unlimited permission is never scored on its dollar amount.** Reachable value is
   today's balance, not what the permission permits.

## Known limitations

These are documented boundaries, not vulnerabilities. Reports are still welcome if the
documentation is wrong:

- ERC-20 allowance approvals only. ERC-721 / ERC-1155 approvals and off-chain permits
  (Permit2, ERC-2612) are invisible until redeemed.
- Approval history is bounded by whatever log window the configured RPC endpoint will answer.
- A wallet with thousands of approvals will not have all of them enumerated in one scan.
- A clean dashboard is not a clean bill of health, and the interface says so on every scan.

## Supported versions

The deployed site and the `master` branch are the supported versions. There are no
maintained release branches yet, so fixes land on `master` and are redeployed.
