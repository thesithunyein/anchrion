# Demo video script

Target length **2:45**. Record at 1440×900 or wider, 720p minimum, no voice-over
music and no music under text. Speak in your own voice; do not read this
word-for-word, it is a shot list with the points that must land.

## The rule that decides this video

A judge must be able to answer four questions from the first 25 seconds:

1. **Who has the problem?**
2. **What is the problem?**
3. **What did you build?**
4. **Why is it meaningfully better?**

So the video opens on the *product working*, not on a slide.

---

## The 20-second test (rehearse this until it is muscle memory)

> Open [anchrion.sithunyein.com/dashboard](https://anchrion.sithunyein.com/dashboard)
> → paste an address → the findings appear.

No wallet install, no signup, no keys. **This is the strongest thing about the
project and it is the first thing on screen.** If the video spends its opening on
a problem slide, this advantage is wasted.

---

## Shot list

### 0:00–0:20 — Paste an address, get findings

- Screen: the dashboard connect screen. Point at the address field.
- Type the demo address, press **Inspect**.
- The scan completes. Do not cut the wait out entirely — 6 seconds of a real scan
  performing real work reads as honesty, not slowness.

**Say:** *"No wallet, no signup. I paste any address and in a few seconds I get
what it is currently allowed to hand over."*

Cue the stats row: live permissions, value at risk, health score.

### 0:20–0:45 — The finding a watchlist cannot produce

- Expand the highest-risk row.
- Point at the spender **address with no label** and the **Unlimited** allowance.
- Expand **Why this scored N/100** and read one factor aloud, including its
  `detected` / `estimated` tag.
- Scroll to **What we measured** and point at any line that says *not measured*.

**Say:** *"This is a contract nobody has heard of, with an unlimited USDC
allowance. It is not on any list — it is on screen because it came out of this
wallet's own history, and we read the allowance live from the token contract to
confirm it is real."*

**This is the answer to "why is it meaningfully better". Do not rush it.**

### 0:45–1:15 — The part nobody else builds

- Switch to **Incident reconstruction**. Run it.
- Walk the narrative lines, one at a time, slowly.
- Point at one transfer row and open its explorer link in a second tab.

**Say:** *"Every tool in this category warns you before you sign. None of them
explain this. These are transfers that left the wallet inside transactions the
wallet never sent — funds only move that way when a permission is used. Anchrion
names who used it, which permission allowed it, and what else that same deployer
can still reach."*

### 1:15–1:40 — Revoke, for real

- Go back to **Approvals**, tick two rows, **Revoke selected**.
- Show the wallet prompt, then `Confirming on chain…`, then `Revoked`, then the
  explorer link.

**Say:** *"Revoking is `approve(spender, 0)` through your own wallet. Pending and
confirmed are real states, and after the receipt lands Anchrion rescans — so what
you see is what the chain says, not what the UI hoped."*

If you do not want to spend mainnet gas on camera, do this whole beat on Sepolia —
the UI says which network it is on, at all times, in the header.

### 1:40–2:10 — Honesty, shown rather than claimed

- Scroll to **What this scan actually covered**.
- Point at: pairs checked, **granted then revoked** versus **candidate pairs never
  granted** (two different numbers, deliberately), and the log window reached.

**Say:** *"Here is what I want you to check. The coverage panel names what this
scan could not see. We separate permissions that existed and were revoked from
candidate pairs that were never granted. And if a signal could not be measured, it
says not measured — it never says safe."*

**This beat is the one that separates this entry from every other submission.**

### 2:10–2:30 — The unsolved problem, stated plainly

- Cut to a simple frame (deck slide 3): $494M → $83.85M, down 83%.

**Say:** *"Drainer losses fell 83% in 2025. Prevention is working — that is Rabby,
MetaMask and Revoke.cash doing their jobs. Which is exactly why the unsolved
problem is no longer stopping the drain. It is explaining the one that already
happened, to the person sitting there with eleven permissions and no idea which
one took the money."*

### 2:30–2:45 — Close

- Back to the dashboard, side by side with the GitHub repo.
- On screen: `anchrion.sithunyein.com` and `github.com/thesithunyein/anchrion`.

**Say:** *"Anchrion covers ERC-20 allowances only — that is a real limit and the
README says so. Everything you just watched runs with no API keys, and the
incident you saw is reproducible with a testnet drainer in the repo. Paste any
address and see it yourself."*

---

## Recording checklist

- [ ] 720p minimum, no AI voice, no music under narration
- [ ] Network badge visible in the header at least once (Sepolia vs Mainnet)
- [ ] Address field typed on camera — the paste-any-address flow must be shown, not described
- [ ] At least one factor expanded with its `detected` / `estimated` tag visible
- [ ] At least one line on screen reading *not measured*
- [ ] Coverage panel shown, with both the revoked and never-granted counts
- [ ] One real transaction hash, clickable, on screen
- [ ] No unedited wait longer than ~8 seconds
- [ ] Every claim about the incident verified: the transaction is a real testnet or
      mainnet transaction, never a mock

## Never do this on camera

- Do not present `DemoDrainer.sol` as a live attacker victim. It is a labelled
  **testnet** harness and the video must say so if it appears.
- Do not claim AI, threat intelligence, or sponsor integrations. Anchrion has none
  of those, and inventing them is the fastest way to lose the entry.
