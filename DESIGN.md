# Design System — España Transparente

## Product Context

- **What this is:** Public data portal tracking Spanish deputies, votes, contracts, subsidies, revolving doors, and spending chains — all sourced from official public records.
- **Who it's for:** Spanish citizens, journalists, researchers — anyone who wants to hold political power accountable with primary sources.
- **Space/industry:** Civic transparency / investigative data portal. Not a government service, not an NGO portal, not a news site.
- **Project type:** Data web app with editorial landing pages.
- **Memorable thing:** Sharp and uncomfortable. A deputy's name next to their votes should feel like a dossier being opened, not a profile being browsed.

## Aesthetic Direction

- **Direction:** Forensic Minimalism — the visual language of the document that ends a career.
- **Decoration level:** None. Typography and data structure carry everything. No background textures, no decorative patterns, no illustrative icons.
- **Mood:** Cold precision. The UI gets out of the way. Data is the main event. Every design choice amplifies discomfort rather than softening it.
- **What it is NOT:** Not brutalism (chaotic). Not noir (romantic). Not hacker (playful). Not government portal (bureaucratic). Not NGO civic tech (approachable). Not newspaper (cozy).
- **Category defined:** Investigative evidence portal. The first of its kind visually.

## Typography

- **Display/Hero:** Cabinet Grotesk ExtraBold / Black — for oversized numbers, impact headlines, names. Sharp, compressed, authoritative without warmth. Load via Fontshare CDN: `https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800,900&display=swap`
- **Body/UI:** Geist (already loaded as local variable font in `web/src/app/fonts/GeistVF.woff`) — navigation, prose, labels, all UI chrome.
- **Data/Tables:** Geist Mono (already loaded as `web/src/app/fonts/GeistMonoVF.woff`) — **ALL numeric data everywhere**: every euro amount, vote count, contract ID, date, percentage, stat card value. Not just code blocks. Every number in every table is Geist Mono.
- **Label/Caption:** Geist at 11px, `--text-muted`, letter-spacing 0.08em, uppercase for field labels.
- **Font loading:** Cabinet Grotesk from Fontshare CDN; Geist and Geist Mono from local variable fonts (zero additional network requests for body/data fonts).

### Type Scale

| Role | Font | Size | Weight | Letter-spacing |
|------|------|------|--------|----------------|
| Hero number | Cabinet Grotesk | 72–96px | 900 | -0.03em |
| Hero name | Cabinet Grotesk | 40–56px | 900 | -0.02em |
| Section heading | Cabinet Grotesk | 28–36px | 900 | -0.02em |
| Card title | Geist | 18px | 600 | 0 |
| Body | Geist | 15px | 400 | 0 |
| Data value | Geist Mono | 13–28px | 400–500 | 0 |
| Field label | Geist Mono | 12px | 400 | 0.10em |
| Caption/meta | Geist Mono | 12px | 400 | 0.08em |

## Color

### Dark Archive (primary — default on load)

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#0B0B0A` | Page background — matte black, warmer than pure black |
| Surface | `#141412` | Cards, tables, panels |
| Surface Alt | `#1D1D1A` | Table row hover, secondary panels, header bar |
| Text | `#EEEDE9` | Primary text — off-white with slight warmth (aged paper inverted) |
| Muted | `#999992` | Metadata, timestamps, secondary labels |
| Signal | `#C8FF00` | Acid yellow-green — divergences, exceptions, highlights. Zero political valence: no red-PSOE, no blue-PP association. Pure forensic highlighter energy. |
| Signal dim | `rgba(200,255,0,0.12)` | Signal backgrounds, alert panels |
| Border | `#2A2A27` | All dividers and card borders |

### Light variant (accessibility toggle — not default)

| Token | Hex |
|-------|-----|
| Background | `#F2F2EF` |
| Surface | `#FFFFFF` |
| Surface Alt | `#F5F5F2` |
| Text | `#0A0A07` |
| Muted | `#777770` |
| Signal | `#5E7A00` |
| Border | `#E2E2DE` |

### Domain semantic colors (preserved — do not change)

These encode the meaning of votes and are used across all voting UI. Not decorative.

| Token | Hex | Meaning |
|-------|-----|---------|
| Vote Sí | `#22c55e` | Affirmative vote |
| Vote No | `#ef4444` | Negative vote |
| Vote Abstención | `#f59e0b` | Abstention |
| Vote No vota | `#4b5563` | Absent / did not vote |

## Spacing

- **Base unit:** 8px
- **Density:** Dense on data pages (table row height ~32–36px, padding 10px 20px). More open on landing and profile pages.
- **Scale:** 2xs(4) · xs(8) · sm(12) · md(16) · lg(24) · xl(32) · 2xl(48) · 3xl(64)
- **Container:** max-width 1700px, padding 0 32px

## Layout

- **Approach:** Left-anchored, poster-first. Content starts top-left with deliberate empty space. No centered hero stacks.
- **Homepage first viewport:** One oversized number or name, cold eyebrow label above it, data label below. The number appears before the user knows what it means — the label resolves it. This discomfort is intentional.
- **Every page is a case sheet:** Hero line → trace chain (person → vote/contract → source document).
- **Grid:** Single fluid column on mobile; structured multi-column on desktop.
- **Max content width:** 1700px
- **Border radius:** 2px maximum. Near-sharp edges everywhere. No softness.

## Motion

- **Approach:** Minimal-functional only.
- **Remove:** Card hover-float (`-translate-y-0.5` / `hover:shadow-md`) — too playful.
- **Keep:** Page navigation transitions, accordion open/close.
- **No:** Entrance animations, scroll-triggered effects, decorative motion.
- **Easing:** enter `ease-out` · exit `ease-in` · move `ease-in-out`
- **Duration:** micro 50–100ms · short 150–200ms

## Components

- **Stat cards:** Geist Mono for all values. Signal color only for divergence/exception counts.
- **Data tables:** `font-family: var(--font-mono)` on all `<td>` containing numbers, IDs, dates. Surname-first for politician names (`APELLIDOS, Nombre`). Divergence marks as `▲ DIV` in signal color.
- **Badges:** `font-family: var(--font-mono)`, uppercase, 2px radius. Use badge-signal for divergences and anomalies.
- **Buttons:** Primary uses signal background with `#0B0B0A` text. Secondary uses border-only. Ghost uses no border. All 2px radius.
- **Profile/record cards:** Surname uppercase in Cabinet Grotesk. Fields in a grid with Geist Mono values. Alert for divergences in signal-dim background.

## Creative Risks (consciously chosen)

1. **Geist Mono for ALL numeric data** — not just code. Every number in every context: tables, stat cards, contract amounts, vote counts. Makes data feel like audit evidence rather than dashboard metrics.

2. **Acid yellow-green (#C8FF00) as the sole signal accent** — replaces the previous crimson. Removes partisan color association. Used exclusively for divergences, exceptions, and highlighted evidence. Never decorative.

3. **Dark mode as primary** — the portal opens dark. Light mode is an accessibility toggle. Dark surfaces signal: "you are reading something that wasn't designed to be easy."

## Migration from Previous System

| Component | Previous | New |
|-----------|----------|-----|
| Background | Warm cream `#FAFAF7` | Near-black `#0B0B0A` |
| Display font | Newsreader (declared but not loaded) | Cabinet Grotesk (loaded from Fontshare) |
| Body font | Geist | Geist (unchanged) |
| Signal accent | Crimson `#A1242C` | Acid green `#C8FF00` |
| Border radius | 0.55rem (~8.8px) | 2px |
| Background grid | 44px grid pattern | Removed |
| Card hover | Float `-translate-y-0.5` | Removed |
| Dark mode | Secondary toggle | Primary default |

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-18 | Created design system from scratch | No existing DESIGN.md; previous direction was undocumented and editorially misaligned |
| 2026-05-18 | Dark mode as primary | All three independent model voices (Claude main, Codex, Claude subagent) converged on dark-first independently |
| 2026-05-18 | Acid green signal over crimson | Removes political color coding; forensic highlighter energy with no partisan valence |
| 2026-05-18 | Geist Mono for all numeric data | Makes every number feel like a line in an audit log, not a dashboard metric |
| 2026-05-18 | Cabinet Grotesk display font | Replaces Newsreader (which was declared but never loaded); sharper, more compressed, no warmth |
| 2026-05-18 | Remove background grid | 44px grid softened the aesthetic; removing it sharpens the forensic register |
| 2026-05-18 | Remove card hover-float | Too playful for this aesthetic direction |
| 2026-05-18 | 2px border radius | Near-zero softness everywhere |
