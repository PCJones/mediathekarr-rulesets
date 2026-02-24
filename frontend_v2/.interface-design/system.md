# Design System — MediathekArr Rulesets

Extracted from `frontend_v2/src/`. Source of truth for UI consistency.

---

## Stack

- **Framework**: SvelteKit 5 (runes: `$state`, `$derived`, `$props`, `$bindable`, `$effect`)
- **Styling**: Tailwind CSS 4 with `@theme` + CSS custom properties
- **Components**: `src/lib/components/ui/` — wrap CSS classes with typed Svelte props
- **Icons**: Inline Heroicons SVGs (outline + solid), `currentColor`

---

## Color

Semantic CSS custom properties. 3 palettes x 2 modes = 6 combos.

### Palettes

| Palette  | Accent (dark) | Accent (light) |
|----------|---------------|-----------------|
| Signal   | `#3b82f6`     | `#2563eb`       |
| Indigo   | `#818cf8`     | `#6366f1`       |
| Emerald  | `#10b981`     | `#059669`       |

### Tokens

| Token              | Role                        |
|--------------------|-----------------------------|
| `bg`               | Page background             |
| `surface`          | Card/panel background       |
| `surface-raised`   | Hover/header fills          |
| `text`             | Primary text                |
| `text-secondary`   | Labels, subtitles           |
| `text-tertiary`    | Hints, placeholders, meta   |
| `accent`           | Primary actions, links      |
| `accent-hover`     | Accent hover state          |
| `accent-text`      | Text on accent background   |
| `border`           | Light borders (8-10% opacity) |
| `border-strong`    | Heavier borders (18-22% opacity) |
| `success`          | Positive states             |
| `warning`          | Caution states              |
| `error`            | Negative states             |
| `info`             | Informational states        |

### Color-mix convention

Semantic color variants use `color-mix(in srgb, ...)`:
- Badge/Alert bg: **15%** variant color into transparent
- Badge/Alert border: **30-40%** variant color
- Status row bg: **5%** variant color
- Table zebra: **50%** surface into bg

---

## Typography

| Property   | Value                                           |
|------------|-------------------------------------------------|
| Base size  | `18px` (set on `html`)                          |
| Sans       | `Inter`, ui-sans-serif, system-ui, sans-serif   |
| Mono       | `JetBrains Mono`, ui-monospace, Cascadia Code   |

### Scale (Tailwind classes)

| Use              | Class                  | ~Size |
|------------------|------------------------|-------|
| Hero heading     | `text-3xl md:text-4xl` | 30/36px |
| Page heading     | `text-2xl font-bold`   | 24px  |
| Section heading  | `text-xl font-semibold`| 20px  |
| Card heading     | `font-semibold`        | 18px (base) |
| Modal title      | `text-lg font-semibold`| 18px  |
| Body / default   | `text-sm`              | 14px  |
| Component text   | `0.875rem` (CSS)       | 14px  |
| Small text       | `text-xs`              | 12px  |
| Table / compact  | `0.8125rem` (CSS)      | 13px  |
| Badge small      | `0.6875rem` (CSS)      | 11px  |

### Weights

- `400` — body text
- `500` — labels, buttons, table headers, badges
- `600` (`font-semibold`) — card/section headings
- `700` (`font-bold`) — page headings, brand

---

## Spacing

Base unit: **4px** (Tailwind default).

### Frequent values

| px  | Tailwind | Common use                          |
|-----|----------|-------------------------------------|
| 4   | `1`      | Tight gaps, label-to-input          |
| 6   | `1.5`    | Badge/icon gaps                     |
| 8   | `2`      | Button padding-y, inline gaps       |
| 12  | `3`      | Card inner gaps, grid gaps          |
| 16  | `4`      | Card body, page px, section gaps    |
| 24  | `6`      | Section spacing, main py            |
| 32  | `8`      | Hero padding                        |
| 40  | `10`     | Large section spacing               |

### Layout spacing

- Container: `max-w-7xl mx-auto px-4`
- Page content top: `py-6`
- Section vertical: `space-y-6` or `space-y-10`
- Grid gap: `gap-3` (compact) or `gap-4` (standard)

---

## Depth

**Borders-only** — no shadows anywhere.

- All `--shadow-*` tokens set to `0 0 0 0 transparent` in `@theme`
- Depth comes from `1px solid` borders using semantic tokens
- `border` for subtle separation
- `border-strong` for interactive element outlines (inputs, buttons)

---

## Radius

| Value    | Tailwind       | Use                                    |
|----------|----------------|----------------------------------------|
| 4px      | `rounded`      | Tooltip, scrollbar thumb               |
| 6px      | `rounded-md`   | Buttons, inputs, selects, alerts, dropdowns |
| 8px      | `rounded-lg`   | Cards, tables, modals                  |
| 9999px   | `rounded-full` | Badges/pills, icon buttons, circles    |

---

## Components

### Button `.btn`

| Variant     | Background      | Border         | Text              |
|-------------|-----------------|----------------|-------------------|
| secondary   | `surface`       | `border-strong`| `text`            |
| primary     | `accent`        | `accent`       | `accent-text`     |
| ghost       | transparent     | transparent    | `text-secondary`  |
| danger      | transparent     | `error`        | `error`           |

| Size | Padding (CSS)       | Font size |
|------|---------------------|-----------|
| sm   | `0.25rem 0.625rem`  | 13px      |
| md   | `0.5rem 1rem`       | 14px      |
| lg   | `0.625rem 1.5rem`   | 16px      |
| icon | `0.375rem`          | —         |

Font weight: `500`. Line-height: `1.25rem`. Radius: `6px`.
Disabled: `opacity: 0.5`, `cursor: not-allowed`.
Hover (secondary): `surface-raised` bg, `text-tertiary` border.

### Card `.card`

- Border: `1px solid border`
- Background: `surface`
- Radius: `8px` (`rounded-lg`)
- Padding: `none` (0) | `sm` (12px) | `md` (16px) | `lg` (24px)
- Interactive: `hover:border-accent transition-colors`

### Input `.input`

- Padding: `0.5rem 0.75rem` (8px 12px)
- Font: `0.875rem` (14px)
- Border: `1px solid border-strong`
- Background: `bg` (page bg, not surface)
- Radius: `6px`
- Focus: `border-color: accent`, no outline ring
- Small: `0.25rem 0.5rem` (4px 8px), font `0.8125rem` (13px)
- Label: `text-sm font-medium text-text-secondary`
- Error: `text-xs text-error`

### Select `.select`

Same as input, with custom chevron SVG background image. `appearance: none`.

### Badge `.badge`

- Shape: pill (`rounded-full`)
- Padding: sm `1px 6px` | md `2px 8px` | lg `4px 12px`
- Font: sm `11px` | md `12px` | lg `14px`, weight `500`
- Default: `surface` bg, `border`, `text-secondary`
- Variants (accent/success/warning/error/info): `color-mix` 15% bg, 30% border, full-strength text

### Alert `.alert`

- Layout: `flex` with icon + content
- Padding: `0.75rem 1rem` (12px 16px), gap `0.75rem` (12px)
- Radius: `6px`
- Default: `surface` bg, `border`
- Variants: `color-mix` 40% border, 8% bg
- Icon: `h-5 w-5`, variant color, Heroicons outline

### Table `.data-table`

- Cell padding: `0.25rem 0.75rem` (4px 12px)
- Font: `0.8125rem` (13px)
- Header: sticky, `surface-raised` bg, `border-strong` bottom, `text-secondary`
- Zebra: `color-mix(in srgb, surface 50%, bg)` on even rows
- Hover: `surface-raised`

### Modal

- Native `<dialog>` element
- `rounded-lg border border-border bg-surface`
- Backdrop: `bg-black/50`
- Title bar: `px-4 py-3 border-b border-border`
- Content: `p-4`
- Close button: `rounded-full p-1` icon button
- Min width: `320px`, max width: `lg` (~32rem)

### Dropdown

- Absolute positioned, `top-full mt-1`
- `rounded-md border border-border bg-surface py-1`
- Min width: `160px`
- Items: `px-3 py-2 text-sm hover:bg-surface-raised`

### Tooltip

- Absolute positioned relative to trigger
- `rounded border border-border bg-surface-raised px-2 py-1 text-xs text-text-secondary`
- `pointer-events-none`, `whitespace-nowrap`

### Spinner `.spinner`

- CSS border animation, `2px solid border`, top color `accent`
- Sizes: sm `1rem` | md `1.5rem` | lg `2.5rem`
- Animation: `spin 0.6s linear infinite`

---

## Patterns

### Page header

```svelte
<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
  <div>
    <h1 class="text-2xl font-bold">Title</h1>
    <p class="text-text-secondary mt-1">Subtitle</p>
  </div>
  <!-- Actions (buttons) on the right -->
</div>
```

### Empty state

```svelte
<div class="text-center py-12">
  <svg class="h-16 w-16 mx-auto mb-4 text-text-tertiary opacity-40">...</svg>
  <p class="text-lg text-text-secondary">Primary message</p>
  <p class="text-sm text-text-tertiary mt-2">Secondary message</p>
</div>
```

### Interactive card (link)

```svelte
<a href="..." class="card hover:border-accent transition-colors block">
  <div class="p-4">...</div>
</a>
```

### Filter tabs (segmented control)

```svelte
<div class="flex gap-1 border border-border rounded-lg p-1">
  <button class="px-3 py-1.5 text-sm rounded-md transition-colors"
    class:bg-accent={active} class:text-accent-text={active}
    class:text-text-secondary={!active}>
    Label
  </button>
</div>
```

### Loading state

```svelte
<div class="flex justify-center py-12">
  <Spinner size="lg" />
</div>
```

### Content grids

| Layout              | Classes                                      |
|---------------------|----------------------------------------------|
| Feature cards (3)   | `grid grid-cols-1 md:grid-cols-3 gap-4`      |
| Media cards         | `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4` |
| Compact thumbnails  | `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3` |
| Stacked list        | `space-y-3`                                  |

---

## Transitions

- **Global** (all elements): `background-color, border-color, color` — `200ms ease`
- **Component hover**: `150ms ease`
- **Wizard steps**: `opacity + translateX(20px)` — `300ms ease-out`
- **Result items**: `translateY(-1px)` on hover — `200ms ease`

---

## Icon Sizes

| Class        | Size  | Use                                 |
|--------------|-------|-------------------------------------|
| `h-3.5 w-3.5` | 14px | Inline meta icons (votes, comments) |
| `h-4 w-4`   | 16px  | Button icons, small actions         |
| `h-5 w-5`   | 20px  | Nav icons, alert icons, close       |
| `h-6 w-6`   | 24px  | Feature card icons                  |
| `h-8 w-8`   | 32px  | Placeholder icons                   |
| `h-10 w-10` | 40px  | Empty state icons                   |
| `h-12 w-12` | 48px  | Large placeholder icons             |
| `h-16 w-16` | 64px  | Hero empty state icons              |

---

## Naming

- CSS utility classes in `app.css` `@layer components`
- Svelte components in `src/lib/components/ui/` with `interface Props`
- Snippet-based composition (Svelte 5 `{@render children()}`)
- German UI labels throughout (Schließen, Laden, Vorschläge, etc.)
