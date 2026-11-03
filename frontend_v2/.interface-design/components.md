# Components

CSS classes live in `app.css` `@layer components`; Svelte wrappers in `src/lib/components/ui/`.

| Component | Key rules |
|---|---|
| `.btn` | radius 6px, weight 500. Variants: default (`surface` + `border-strong`), `btn-primary` (accent), `btn-ghost` (transparent, `text-secondary`), `btn-danger` (error outline, filled on hover). Sizes `btn-sm` / default / `btn-lg`. Disabled: 50 % opacity. |
| `.card` | `rounded-lg border border-border bg-surface`; padding via `p-3`/`p-4`. Interactive: `hover:border-accent`. Prefer one card per topic, never a stack. |
| `.input` / `.select` | `bg-bg`, `border-strong`, radius 6px, focus = accent border, no ring. Label `text-sm font-medium text-text-secondary`, error `text-xs text-error`. |
| `.badge` | pill, sizes sm/md/lg, weight 500. Default `surface` + `border`; variants accent/success/warning/error/info use the 15 % / 30 % tint rule. |
| `.alert` | icon + content, `px-4 py-3`, radius 6px, variant tint 8 % bg / 40 % border. |
| `.data-table` | 13px, cells `px-3 py-1`, sticky `surface-raised` header, zebra rows, hover `surface-raised`. |
| Modal | native `<dialog>`, `rounded-lg border bg-surface`, `bg-black/50` backdrop, title bar `px-4 py-3 border-b`. |
| Dropdown | `top-full mt-1 rounded-md border bg-surface py-1`, items `px-3 py-2 text-sm hover:bg-surface-raised`. |
| `Tooltip` | `?` icon trigger, box `rounded border bg-surface-raised px-2 py-1 text-xs`. Keep tooltip text to one sentence. |
| `.spinner` | sm 1rem / md 1.5rem / lg 2.5rem. |

## Recurring patterns

- **Page header:** title left, actions right; stacks below `md`.
- **Empty state:** centred icon (`text-tertiary opacity-40`), message `text-text-secondary`, hint `text-sm text-text-tertiary`.
- **Segmented filter:** `flex gap-1 border rounded-lg p-1`, active item `bg-accent text-accent-text`.
- **Underline tabs:** `border-b`, items `-mb-px border-b-2 py-2.5 text-sm font-medium`, active `border-accent text-text font-semibold`.
- **Loading:** `flex justify-center py-12` + `Spinner size="lg"`.
- **List row:** full-row link `card hover:border-accent p-4`, title + badges on line 1, `text-xs` meta on line 2.
- **Sticky action bar:** `sticky bottom-0 border-t bg-surface px-4 py-3`, status left, actions right.
