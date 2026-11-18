# Interface Design System — MediathekArr Rulesets (frontend_v2)

## Grundlagen

- Root-Schriftgröße ist fest **18px** (`app.css`, `html { font-size: 18px }`): 1rem = 18px. Alle rem-Budgets (Grid-Tracks, Container-Breakpoints) damit rechnen.
- Farben nur über die Paletten-Tokens (`--color-text`, `--color-text-tertiary`, `--color-accent`, `--color-border`, …), nie Hex.
- Regex-Capture-Groups werden in Akzentfarbe, `font-weight: 600` hervorgehoben (`.group-capture`).

## Ruleset-Liste (`RulesetRow.svelte`, `RulesetFacet.svelte`, `utils/rulesetFacets.ts`)

Vergleichbare Liste: gleiche Facetten aller Rulesets stehen einmal oben („Für alle“), nur variierende Facetten werden Spalten.

### Tabelle vs. gestapelt

- Umschalten nach **Kartenbreite**, nicht Viewport: Karte ist `@container` und trägt `data-ruleset-columns={rulesetTableDensity(varying)}`.
- Variante `ruleset-table:` (`app.css`, `@custom-variant`):
  - `normal` (≤ 1 Pattern-Spalte und ≤ 1 Text-Facette) → Tabelle ab **64rem** (1152px) Kartenbreite
  - `dense` (sonst) → Tabelle ab **72rem** (1296px)
- Alle Tabellen-Klassen (Grid, Subgrid-Zeilen, Kopfzeile, Label-Ausblendung) nutzen `ruleset-table:`, keine `md:`/`lg:`-Breakpoints.
- Gestapelt: Pattern-Labels stehen immer **über** dem Muster (`block mb-0.5`), Text-Labels inline davor.

### Grid-Tracks (`gridColumns`)

| Spalte | Track | Warum |
|---|---|---|
| `#` | `auto` | |
| Topic, Strategie | `auto` | kurz |
| Staffel/Episode, Titel-Regeln | `minmax(12rem, 1fr)`; beide variierend: je `minmax(8rem, 1fr)` | auto-Tracks wachsen vor fr-Tracks — ohne echtes Minimum verhungert der Regex |
| Filter | `fit-content(12rem)` | |
| Folgen | `fit-content(13rem)` | Balken 7rem + Zahl 5rem + Gap |
| Aktionen | `fit-content(10rem)` (bzw. `minmax(0,1fr)` ohne fr-Spalte) | Badges/Button stapeln statt Zeile zu verbreitern |
| Controls | `auto` | |

- `min-w-0` **nur** auf Pattern-Zellen. Auf anderen Zellen setzt es das Grid-Minimum auf 0 → Spalten werden unter ihren Inhalt gequetscht und überlappen.
- Spaltenköpfe `whitespace-nowrap`.

### Regex-Darstellung

- S/E (bzw. `title`) untereinander, Kürzel `0.6875rem`/500/tertiary, `flex-shrink: 0`.
- `splitCaptureGroups` teilt an Top-Level-Gruppen (Capture-Groups markiert, Lookarounds/non-capturing als eigene Teile).
- Jeder Teil ist `.token`: `inline-block; max-width: 100%; overflow-wrap: anywhere; vertical-align: top` + `<wbr>` dazwischen → Umbruch nur an Token-Grenzen, im Token nur bei Überlänge; `vertical-align: top` hält die Grundlinie auf der ersten Zeile (Kürzel-Ausrichtung).
- Nie `word-break: break-all` auf Patterns.
- Filter: jeder Filter `whitespace-nowrap`, Umbruch nur zwischen Filtern.
