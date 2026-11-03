### MediathekArr Rulesets

Web app to define rulesets for shows/movies, used in [MediathekArr](https://github.com/PCJones/mediathekarr)

> **⚠️ Frontend AI Disclosure:** The frontend (`frontend_v2`) was heavily LLM-assisted (aka vibe coded) - I suck big time at frontend development. The backend and the main [MediathekArr](https://github.com/PCJones/mediathekarr) project are **not** affected by this. If you're a frontend developer and want to do this properly, I'll gladly accept a PR!

Important for setup:

- Disable access to /api/v1/database and/or /api/v2/database (.htaccess or something like that - already configured, but double check it works)
- rename config.example.php > config.php
- Change JWT_SECRET in config.php
- If needed set CORS allowed origin in config.php
- Open `/api/v2/install.php` once to create the database and the admin account (re-opening it later only applies schema migrations)
- Optional GitHub login: create an OAuth app at https://github.com/settings/developers with callback URL `<frontend-url>/auth/github/callback` and set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in config.php. Registration with username/email/password works without it.

### Vorschläge (Community-Workflow)

Angemeldete Nutzer ändern Rulesets nicht direkt, sondern sammeln ihre Änderungen als **Vorschlag**:

1. **Sammeln** — auf der Media-Seite (`/media/{id}/rulesets`) schaltet die erste Aktion (Bearbeiten, Duplizieren, Löschen, Neues Ruleset, ▲/▼) in den Entwurfsmodus. Die Leiste am unteren Rand zeigt Änderungszähler und die selbst gemessene Abdeckung. Neue Serien/Filme werden über `Neue Serie/Film vorschlagen` auf `/media` vorgeschlagen und zusammen mit dem Vorschlag angelegt.
2. **Einreichen** — `Vorschlag einreichen` verlangt eine Begründung (min. 10 Zeichen) und legt den Vorschlag an (`/suggestions/{id}`). Pro Nutzer und Medium ist genau ein offener Vorschlag erlaubt; weitere Änderungen werden als neue Revision gespeichert. Fremde Vorschläge lassen sich mit `Als neuen Vorschlag kopieren` forken.
3. **Prüfen** — Admins sehen auf der Detailseite die Prüfung-Karte: Kommentar (beim Ablehnen Pflicht), `Annehmen` (Bestätigungsdialog) und `Ablehnen`. Wurde ein betroffenes Live-Ruleset zwischenzeitlich geändert, ist der Vorschlag **veraltet**; Annehmen ist gesperrt, bis Autor oder Admin die Basis über `Basis aktualisieren` aktualisiert.
4. **Anwenden** — beim Annehmen legt der Server Rulesets an, ändert oder löscht sie und nummeriert die Prioritäten neu. Autor, prüfender Admin und das Ergebnis bleiben am Vorschlag gespeichert.

Autor und Admins können einen offenen Vorschlag über `Bearbeiten` erneut im Wizard öffnen (`?draft=suggestion:<id>`); jede Speicherung erzeugt eine Revision, der Verlauf auf der Detailseite zeigt die Unterschiede zwischen zwei Revisionen.

**Dev-Setup:** `docker compose up -d` in `local_dev/` startet die API auf `http://localhost:8090/v2`, das Frontend läuft mit `npm run dev` in `frontend_v2` auf `http://localhost:5173`. Die Dev-API erlaubt per CORS **nur** `http://localhost:5173` — ein anderer Port/Host schlägt fehl, bis `CORS_ALLOWED_ORIGIN` in `api/v2/config.php` angepasst ist. Nach dem Einrichten über `install.php` existiert nur das dort angelegte Admin-Konto; weitere Testnutzer werden über `/register` angelegt. Die Vorschlagstabellen sind zunächst leer — Fixtures entstehen am einfachsten über den Workflow oben.
