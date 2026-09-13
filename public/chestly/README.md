# Chestly — the design, as one file

A complete app UI in the sticker-and-graph-paper visual language: light warm
grey, ultra-heavy display type with a hard offset shadow, indigo pill calls to
action, floating icon stickers, a fixed right-hand action rail and a sticky
bottom dock.

**A design study, separate from Anchrion.** It lives in this repository only as
static files under `public/chestly/`, it shares no code with the app, and it is
reachable at `/chestly` (resolved by the rewrites in `next.config.ts`).

Open `index.html` in a browser, or visit the published path. No build, no
server, no dependencies — the only external requests are three Google font
families. Everything you see, including the prize machine and every icon, is
drawn with CSS or inline SVG.

## Screens

Hash-routed, all in the one file:

| Route | Screen |
| --- | --- |
| `#/` | Home — hero, prize machine, monthly milestones, chest tiers |
| `#/upload` | Upload — drop zone, form fields, eligibility card, round progress |
| `#/rewards` | Rewards — unclaimed chests, how the pool is split |
| `#/fame` | Hall of Fame — ranked creator table |

## Tokens

All in `:root` at the top of the file.

| Group | Values |
| --- | --- |
| Surfaces | `--paper #f4f4f5` · `--grid-line #e7e7ea` · `--card #fff` · `--line #e5e7eb` |
| Ink | `--ink #17181c` · `--ink-soft #3f3f46` · `--muted #6b7280` · `--faint #9ca3af` |
| Accents | `--indigo #3c56f0` · `--blue #2563eb` · `--amber #f5a623` · `--red #ef4444` · `--green #16a34a` · `--violet #7c3aed` · `--teal #0d9488` |
| Type | `--font-display` Archivo Black · `--font-body` Inter · `--font-mono` JetBrains Mono |
| Shape | `--r-pill` 999 · `--r-lg` 26 · `--r-md` 18 · `--r-sm` 12 |
| Depth | `--sh-card`, `--sh-rail`, `--sh-pill`, `--sh-primary` |

## Components

`.btn-primary` `.btn-dark` `.btn-quiet` · `.inp` `.sel` `.area` `.drop` `.seg`
`.check` · `.card` `.tier` `.chip` · `.track` + `.track-marks` + `.mark` · `.tbl`
`.rank` `.ava` · `.acc` · modal (`.scrim` + `.modal`) · toast · `.stick`

The sticker text effect is `text-shadow: .055em .055em 0 var(--ink-soft)` —
em-based, so it stays proportional at any size.

## Live behaviour

A ticking round countdown, the machine's LCD counting up to the real pool
figure, milestone bars that fill when scrolled into view, hash routing with
correct `aria-current`, a rules modal, toasts, a segmented control and form
validation. All motion respects `prefers-reduced-motion`.

## Known gaps

- The artwork is drawn, not rendered — substitute your own 3D assets when you
  have them and nothing else needs to change.
- The rail shows above 1180px and the tier grid goes four-up above 980px; those
  two breakpoints were written but not seen at desktop width in the preview
  used to build this, which was 742px wide.
- Brand name, copy and figures are placeholders.
