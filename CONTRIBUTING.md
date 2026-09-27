# Contributing

Thanks for looking. Anchrion is small on purpose, and the most useful contribution is
usually a correction rather than a feature.

## The one rule

**Accuracy is the product.** A security tool that overstates what it knows is worse than no
tool. So:

- Never let an unmeasured signal read as safe. Unmeasured adds zero and is labelled
  *not measured*.
- Never quote a number the scan did not actually derive. If a read fails, say so.
- If you change what the tool claims, change every place that claims it (see
  *Keeping the docs honest* below).
- A wrong number is a bug of the same severity as a crash. See [SECURITY.md](SECURITY.md).

## Getting set up

```bash
git clone https://github.com/thesithunyein/anchrion.git
cd anchrion
npm install
cp .env.example .env.local
npm run dev
```

Nothing in `.env.example` is required. Every network read uses public RPC and keyless
explorer endpoints; keys only raise rate limits on your own deployment.

## Before you open a pull request

All four must pass. They run in seconds and none of them needs a key:

```bash
npm run typecheck       # tsc --noEmit, expected clean
npm run lint            # eslint, expected 0 problems
npm run build           # builds every route
npm run verify -- 0xYourAddress [chainId]    # recomputes a scan's coverage numbers
```

`npm run verify` is the one to run if you touched anything in `src/lib/approvals`. It
re-derives the coverage panel from the raw explorer and RPC sources **without importing a
line of the application's own code**, and exits non-zero on a mismatch. If your change makes
it disagree, the change is wrong, not the script.

## Keeping the docs honest

Three surfaces describe the same behaviour and they drift if you are not careful:

| If you change | Also update |
|---|---|
| A weight, threshold, or band in `src/lib/risk/scorer.ts` | `src/app/method/page.tsx` and the risk table in `README.md` |
| What a scan reads, or what it can fail to read | The coverage panel copy and the *Limits* section of `README.md` |
| A route or rewrite in `next.config.ts` | The routes table in `README.md` |

The most recent drift was a weight that lived on `/method` and in the scorer but was missing
from the README table. Nobody noticed for as long as it took a reviewer to compare the two.

## Style

- **Commits:** a single imperative sentence, sentence case, no `feat:`/`fix:` prefix. The body
  explains *why* the change is right, not what the diff contains.
- **TypeScript:** strict mode, no `any` in new code, comments that explain a decision rather
  than restate the line.
- **UI copy:** plain language, no hype, and never a claim the code cannot back up. If a number
  is an estimate, the interface says *estimated*.

## Adding a chain

Add the chain to the explorer and RPC maps in `src/lib/chain` and `src/lib/explorer`, register
its well-known routers **only after checking `eth_getCode` return non-empty on that chain**,
and update the supported-networks list in `README.md`. A router entry with no bytecode on a
chain is a bug: it wastes candidate slots and produces a permission that cannot exist.

## Security reports

Do not open a public issue for anything exploitable. Email
**sithunyein.mailto@gmail.com** — see [SECURITY.md](SECURITY.md) for scope and timelines.

## Code of conduct

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Note the
project-specific rule: scans surface real addresses and real losses. Report findings about
addresses and code, never about the people behind them.

## License

By contributing you agree your work is released under the [MIT License](LICENSE).
