# Design System — MediathekArr Rulesets

Source of truth for UI in `frontend_v2/src/`. Details:
- [components.md](components.md) — `.btn`, `.card`, `.input`, `.badge`, `.alert`, `.data-table`, modal, dropdown, tooltip, spinner
- [proposals.md](proposals.md) — proposal (Vorschlag) pages: PR layout, timeline, merge box, diff blocks, coverage wording

## Stack

SvelteKit 5 (runes) · Tailwind 4 (`@theme` maps CSS vars to utilities) · UI wrappers in `src/lib/components/ui/` · inline Heroicons-style stroke SVGs with `currentColor` · German labels throughout.

## Color

3 palettes (signal / indigo / emerald) × light / dark, defined in `app.css`. Use semantic tokens only, never hex in components.

| Token | Role |
|---|---|
| `bg` / `surface` / `surface-raised` | page / panels, header strips / hover, darkest fill |
| `text` / `text-secondary` / `text-tertiary` | body / labels / meta, hints |
| `accent` (`-hover`, `-text`) | actions, links; text on accent |
| `border` / `border-strong` | 8–10 % / 18–22 % opacity lines |
| `success` `warning` `error` `info` | semantic states |

- Tints via `color-mix(in srgb, <color> N%, transparent)`: badge 15 % bg + 30 % border, alert 8 % bg + 40 % border, row/line tints 5–7 %.
- **Contrast:** `text-secondary` and `text-tertiary` reach ≥ 4.5:1 on `surface-raised` in every palette and mode.

## Typography

`html` is **18px**, so Tailwind sizes are larger than usual. Inter (sans), JetBrains Mono (mono, with `tabular-nums` for numbers).

| Use | Class | ≈ px |
|---|---|---|
| Page title | `text-xl font-semibold` | 22 |
| Body, posts | `text-sm` | 16 |
| Dense UI (meta lines, tables, diffs, sidebar) | `text-[0.8125rem]` | 15 |
| Labels, hints | `text-xs` | 13.5 |

Weights: 400 body · 500 labels, buttons, badges · 600 headings · 700 brand only. Avoid unstyled text — it renders at 18px.

## Spacing, depth, radius

- 4px grid. Typical: `gap-1.5` icon gaps, `gap-3` inside components, `space-y-5` between page sections.
- Page container `max-w-7xl mx-auto px-4`; content-heavy pages narrow to `max-w-6xl`.
- **Borders only, no shadows** (all `--shadow-*` are transparent).
- Radius: `rounded` tooltips · `rounded-md` buttons, inputs · `rounded-lg` cards, boxes, modals · `rounded-full` badges, pills, avatars.

## Principles

- **No card stacks.** Group related content in one bordered box with a `bg-surface` header strip; separate sections with `divide-y`, not more cards.
- **Sentences over raw numbers or keys.** „3 Videos mehr werden einer Episode zugeordnet", not a hero number; „Dauer > 56 Min.", not `duration GreaterThan 56`.
- **No unexplained numbers.** Every count gets a label or a one-sentence `title` tooltip.
- **Links to other screens from detail views** (wizard, rulesets) open in a new tab, marked with `↗`.
- Transitions: colors 200 ms globally, hover 150 ms; no bounce.
