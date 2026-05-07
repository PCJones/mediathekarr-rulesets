### MediathekArr Rulesets

Web app to define rulesets for shows/movies, used in [MediathekArr](https://github.com/PCJones/mediathekarr)

> **⚠️ Frontend AI Disclosure:** The frontend (`frontend_v2`) was heavily LLM-assisted (aka vibe coded) - I suck big time at frontend development. The backend and the main [MediathekArr](https://github.com/PCJones/mediathekarr) project are **not** affected by this. If you're a frontend developer and want to do this properly, I'll gladly accept a PR!

Important for setup:

- Disable access to /api/v1/database and/or /api/v2/database (.htaccess or something like that - already configured, but double check it works)
- rename config.example.php > config.php
- Change JWT_SECRET in config.php
- If needed set CORS allowed origin in config.php
