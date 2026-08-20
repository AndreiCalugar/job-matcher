# DESIGN.md

Design system for the job-matching engine. Coding agents read this file to
generate UI that stays visually consistent. Read it before writing any component.

Companion to `CLAUDE.md` — that file defines how to build, this one defines how
it should look.

---

## 1. Visual theme & atmosphere

**The product is an instrument, not a companion.** It tells people they are a
weak fit for jobs they want. Every visual decision follows from that: it should
feel like a precision measuring device — a datasheet, an oscilloscope, a lab
readout — not a productivity app that congratulates you.

Reference points: technical datasheets, engineering graph paper, analytics
consoles. Explicitly **not**: onboarding-flow SaaS, gradient hero sections,
friendly illustration, encouraging micro-copy.

**Density is high.** The user is scanning 40 postings, not admiring 3 cards.
Prefer more rows visible over more padding.

### The governing rule

> **Colour is reserved for data. Chrome is monochrome.**

Buttons, navigation, headers, borders, icons: ink and graphite only. The only
saturated pixels on screen carry measured information — a score, a band, a rate,
a state. This single rule does most of the work of making the product look
unlike its competitors, and it means the eye lands on the number that matters.

If a colour is about to be used decoratively, it is wrong. Use weight or space
instead.

---

## 2. Colour palette & roles

### Light (default)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#EEF1F0` | App background. Cool off-white with a faint green-grey cast. Never pure white, never cream. |
| `--surface` | `#F7F9F8` | Raised surfaces: cards, panels, table headers. |
| `--surface-sunken` | `#E4E8E7` | Inset wells, code blocks, disabled fields. |
| `--ink` | `#14181A` | Primary text, primary buttons, icons. |
| `--graphite` | `#5A6467` | Secondary text, labels, metadata. |
| `--rule` | `#D3D9D7` | Hairline borders, dividers, table lines. |
| `--rule-strong` | `#B6BFBC` | Emphasised dividers, focused borders. |

### Dark

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#101416` | App background. |
| `--surface` | `#171C1F` | Raised surfaces. |
| `--surface-sunken` | `#0B0E10` | Inset wells. |
| `--ink` | `#E8EDEB` | Primary text. |
| `--graphite` | `#8A9598` | Secondary text. |
| `--rule` | `#252C30` | Hairlines. |
| `--rule-strong` | `#394347` | Emphasised dividers. |

Dark mode is not an afterthought — most of this audience will use it. Build both
from day one via `next-themes`, default to system.

### The score scale — the only chroma in the product

Four bands. **Deliberately not a traffic light.** A weak match is not an error
and should not alarm; it should recede. Attention is a scarce resource and
belongs on the strong matches.

| Band | Light | Dark | Meaning |
|---|---|---|---|
| `--band-strong` | `#0B5D4E` | `#3FA98F` | Real fit. The only deep-saturation colour in the UI. |
| `--band-stretch` | `#9A6B10` | `#D2A03A` | Plausible with a good pitch. |
| `--band-weak` | `#6E7A80` | `#78868C` | Long shot. Muted on purpose. |
| `--band-mismatch` | `#A6AFB2` | `#4A5459` | Out of scope. Nearly invisible. |

### Reserved signals

| Token | Light | Dark | Role |
|---|---|---|---|
| `--signal-ghosted` | `#8E4B2E` | `#C77A55` | Ghosted applications only. |
| `--signal-destructive` | `#A32C21` | `#E0655A` | Delete and irreversible actions only. |

Red appears nowhere else. Because it is rare, it means something.

---

## 3. Typography

| Role | Family | Usage |
|---|---|---|
| Display | **Archivo Expanded** | Page titles, section headers, the score readout. 600–700 weight, tracking `-0.01em`. Its width is the product's signature — use it only at 20px and above where the width reads. |
| Body / UI | **Inter Tight** | All interface text, prose, form labels. 400/500/600. Not plain Inter. |
| Data | **IBM Plex Mono** | Every number, score, date, duration, rate, company slug, status token, and table cell containing a figure. |

All three load via `next/font/google`. No other families.

### Scale

| Step | Size / line-height | Use |
|---|---|---|
| `display` | 32 / 36 | Page title |
| `h1` | 24 / 30 | Section header |
| `h2` | 20 / 26 | Panel header |
| `h3` | 16 / 22 | Card title, subsection |
| `body` | 14 / 21 | Default interface text |
| `small` | 13 / 19 | Table cells, secondary detail |
| `micro` | 11 / 14 | Eyebrows, labels. Uppercase, tracking `0.08em`, `--graphite`, IBM Plex Mono. |

### Rules

- **All numerals use `font-variant-numeric: tabular-nums`.** No exceptions.
  Columns of figures must align. This is a measurement product.
- Eyebrow labels are mono, uppercase, micro — they read as field names on a
  datasheet. Use them for section identification, never for decoration.
- Sentence case for everything else. No title case, no ALL CAPS headlines.
- Prose in the app maxes out at 68 characters per line.

---

## 4. Component styling

### Radius
`--radius-sm: 2px` (badges, chips, bars) · `--radius: 4px` (buttons, inputs) ·
`--radius-lg: 6px` (cards, panels, dialogs).

Tight and consistent. Not zero — that reads as a broadsheet pastiche. Not 8px+ —
that reads as consumer software.

### Elevation
**Depth comes from hairlines and surface tint, not shadow.** One shadow token
exists, used only for genuinely floating layers (popover, dropdown, dialog):

```
--shadow-float: 0 8px 24px -8px rgb(20 24 26 / 0.18);
```

Cards and panels get `1px solid var(--rule)` and `--surface`. Nothing else.

### Buttons
- **Primary** — `--ink` fill, `--paper` text. Monochrome. 32px tall, 12px
  horizontal padding, 14px medium.
- **Secondary** — transparent fill, `--rule` border, `--ink` text.
- **Ghost** — text only, `--graphite`, `--ink` on hover.
- **Destructive** — `--signal-destructive` border and text, filled only on hover.
- Focus: `2px` outline in `--ink` at `2px` offset. Always visible, never removed.

### Inputs
32px tall, `--surface` fill, `1px solid --rule`, `--radius`. Focus raises the
border to `--rule-strong` plus the standard focus ring. Errors sit below the
field in `--signal-destructive` at `small`, and state what to do next.

### Tables and lists
The primary workspace. Row height 40px. Header row: micro eyebrow style, sticky,
`--surface`, bottom `1px solid --rule-strong`. Rows separated by `1px solid
--rule`. Hover tints to `--surface`. No zebra striping.

### Badges and status
`--radius-sm`, 11px mono uppercase, `--graphite` text on `--surface-sunken`,
`1px solid --rule`. Status carries no colour except score bands and the two
reserved signals.

---

## 5. Layout

### Spacing
4px base. Scale: `4, 8, 12, 16, 24, 32, 48, 64`. Nothing between steps.

### Shell
Fixed 220px left rail (navigation, monochrome, no icons-with-labels clutter),
then a fluid workspace. On the main screen the workspace is a two-pane split:
a dense list on the left, detail on the right. The list never collapses below
360px on desktop.

### Grid
12-column, 16px gutters, max content width 1440px. Statistics pages may go
full-bleed — charts benefit from the width.

### Whitespace philosophy
Generous *between* groups, tight *within* them. A section gets 32px above it;
rows inside it get 0. Density is the point; the breathing room lives at the
seams.

### Responsive
Breakpoints: 640 / 1024 / 1280. Below 1024 the two-pane split becomes a stack —
list, then detail as a full-screen view with a back control. Touch targets 44px
minimum on coarse pointers. The statistics charts degrade to a scrollable
container rather than shrinking below legibility.

---

## 6. The signature element — the calibration bar

Every match score renders as a **tick-marked horizontal gauge**, never as a bare
number in a coloured pill. It is the one memorable object in the product and it
appears at three scales, always the same primitive:

```
inline   (list row, 64×6px)   ▏░░░░░░░▓▓▓▓▏          62
detail   (header, 320×16px)   ▏░░░░│░░░░│▓▓▓▓│░░░░▏  62  STRETCH
chart    (statistics, full)   response rate plotted against predicted band
```

Rules:
- Ticks at 25 / 50 / 75, `--rule-strong`, always visible. The scale is honest,
  so the scale is shown.
- Fill colour is the score band. Track is `--surface-sunken`.
- The numeral sits to the right in IBM Plex Mono, tabular, `--ink`.
- Never animate the fill on load in the list. In the detail view it may sweep
  once, 240ms, `ease-out`. That is the only animated fill in the product.

On the statistics page the same primitive becomes the calibration chart —
predicted score band on one axis, observed response rate on the other. That
chart is the product's central claim made visible. Give it room.

---

## 7. Do's and don'ts

**Do**
- Reserve colour for measured data.
- Use tabular figures for every numeral.
- Show the pre-mortem in full weight, at `body` size, in `--ink`. It is content,
  not a warning.
- Write empty states as instructions: "Paste a job posting to score it."
- Keep the score visible everywhere the job appears.

**Don't**
- No gradients. Anywhere. Including subtle ones.
- No illustrations, mascots, or spot art.
- No emoji in product surfaces.
- No confetti, celebration states, or congratulatory copy.
- Never soften a weak score with encouraging language or a warmer colour.
- No purple. The category is saturated with it.
- No shadow on cards.
- No skeleton shimmer — use a static `--surface-sunken` block.

---

## 8. Motion

Minimal and functional. Durations: 120ms (hover, focus), 200ms (panel, popover),
240ms (the one calibration sweep). Easing: `cubic-bezier(0.2, 0, 0, 1)`.

Nothing moves that the user did not cause. Respect
`prefers-reduced-motion: reduce` by dropping every transition to 0ms.

---

## 9. Voice

The interface speaks plainly and does not perform enthusiasm.

- Active voice, sentence case, no filler.
- Name things as the user experiences them: "Applications", not "Records".
- A control says what it does: "Generate kit", and the result says "Kit generated".
- Errors state what happened and the next action. They do not apologise.
- Never editorialise a score. `Weak match — 3 critical gaps` is correct.
  `Don't worry, keep trying!` is not.
- Ghosted is called ghosted.

---

## Agent prompt guide

When generating a component, follow this checklist:

1. Monochrome chrome. Colour only if the element carries measured data.
2. `tabular-nums` on every numeral, IBM Plex Mono for data.
3. Hairline borders, `--surface` fill, no shadow unless floating.
4. 4px spacing scale, 40px table rows, 32px controls.
5. Archivo Expanded only at 20px+; Inter Tight for everything else.
6. Visible focus ring, keyboard reachable, reduced-motion respected.
7. Empty and error states written as instructions.

**Starting prompt for a new screen:**
> Build [screen] following DESIGN.md. Monochrome chrome, colour reserved for
> score bands only. Dense two-pane layout, hairline borders, no shadows. All
> figures in IBM Plex Mono with tabular numerals. Include the empty state.
