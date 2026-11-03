# Proposal (Vorschlag) pages

Modelled on a GitHub pull request: conversation tab + changes tab.

## Page (`routes/suggestions/[id]`)

- `mx-auto max-w-6xl`. Title `text-xl` + `#id` in `text-tertiary`; below one `text-sm` line: solid status pill (`rounded-full px-2.5 py-0.5 text-xs text-white`, status colour) + badges + „@author schlägt 2 neue Rulesets für X vor · Revision n".
- Top right: **Upvote** (`VoteButton`: `h-9`, 1.5px accent border, arrow + mono count, no label; idle 8 % accent tint, voted solid accent) and „Bearbeiten" (`btn h-9`).
- Underline tabs „Unterhaltung" / „Änderungen n", kept in `?tab=aenderungen`.

## Conversation tab

- Content + `14rem` sidebar, `gap-8`.
- **Timeline** (`ol.timeline`, 2px `surface-raised` line through 32px `Avatar` centres), oldest first, revisions and comments merged by time:
  - Posts (description, comments): box `rounded-lg border-border-strong bg-bg`, header strip `bg-surface px-3 py-1.5 text-[0.8125rem]` („@user · vor 3 Tagen", `Autor` badge), body `px-3 py-2.5 text-sm`.
  - Revision events: 28px `.timeline-dot` + „@user hat Revision 2 hochgeladen · vor 20 Tagen", then `+ ~ −` lines in plain German with „Details ▸" disclosures.
- **Merge box** after the timeline: one row per check (`✓` / `!` / `–` + bold sentence + `text-sm` detail) for coverage and staleness. Footer `bg-surface`: admins get „Ablehnen" (reveals required reason) + primary „Annehmen"; others „Wartet auf Prüfung durch einen Admin."; resolved proposals show the result.
- Comment composer last.
- **Sidebar:** no cards, `divide-y`, headings `text-xs font-semibold text-secondary`, actions as `btn btn-sm` with icon.

## Changes tab

- Summary line: „n Rulesets · 2 neu" left, `Delta` „Zugeordnete Videos" right.
- **Diff block** per change (`ChangeCard`): `rounded-lg border-border-strong bg-bg`; header strip with OpBadge · mono topic · strategy badge, right „31 Treffer | Zugeordnet 132 → 153 | Im Wizard öffnen ↗" (0 hits in `text-warning`); stale = warning strip; body = diff lines; footer button „Beispiele (n) ▸", collapsed by default.
- **Diff lines** (`RulesetDiff`, `.diff-line`): grid mark · label · value, 13px; `+`/`−` lines tinted 7 % success/error; changed values old (struck) over new. Hide empty fields; omit topic/strategy inside a diff block. Filters as text („Dauer > 56 Min."); only title rules mono.

## Colours and numbers

- Ops: create = success „Neu" · update = info „Geändert" · delete = error · stale = warning „Veraltet".
- `Delta`: mono `before → after`, badge only when ≠ 0.
- **Coverage** never as `x / total`, bar or percent — topics include trailers etc., 100 % is not a goal. Label „Zugeordnet", tooltip „Videos, denen ein Ruleset eine TVDB-Episode zuordnet". Sentence form drops „mehr" when before is 0. New media always start at 0.
