# TODO — token-validator-service

Burndown backlog for the Flask token-validator microservice and its companion
Electron desktop UI (see [`BURNDOWN.md`](./BURNDOWN.md) for the full initiative).
Ship one validated item per cycle via a merged PR; commit trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Newest-first
**Burndown Log** at the bottom.

## High
- [ ] Harden `POST /api/validate-token`: reject missing/empty `token`, non-JSON bodies,
      and non-string tokens with a `400` instead of a 500 (currently `request_data.get`
      assumes a JSON object and `token` is interpolated unvalidated into the tokeninfo URL).
- [ ] Add a real test suite: `pytest` with the Google `tokeninfo` call mocked
      (`responses`/`requests-mock`) covering valid / invalid / malformed-body paths,
      so CI runs actual tests rather than a smoke import.
- [ ] Scaffold the Electron desktop UI (M0): Electron + Vite + React + TS under `desktop/`,
      build-first `electron` script + `electron:dev` HMR, matching the jm/ffmpeg-util pattern.

## Medium
- [ ] Tighten CORS: replace the all-origins `CORS(app)` with an allow-list driven by an
      env var (default to the deployed resume origin) so prod isn't wide open.
- [ ] Add a `/healthz` liveness endpoint (200, no external call) for Cloud Run health checks
      and a fast CI smoke test that doesn't hit Google.
- [ ] Desktop M1 core flow: paste-token textarea + Validate button, IPC bridge
      `validateToken(token)` in preload, render `token_info` claims in a table (humanize `exp`).
- [ ] Never persist tokens: audit logging/state so a token is never written to disk or logs;
      scrub from memory after a check (renderer + main).

## Later
- [ ] Batch validate: paste many tokens, table of results.
- [ ] Offline decode-only mode for JWT-style tokens, clearly separated from live tokeninfo.
- [ ] electron-builder packaging (win/mac/linux) + icon + size budget (desktop M3).
- [ ] README screenshots + a desktop `demo.gif`, wired for the jm showcase demo-media pipeline.
- [ ] Session-only history of *results* (never tokens).

## Burndown Log (newest first)
- 2026-06-30: added `todo.md` burndown backlog (High/Medium/Later) + cut release v0.1.1;
      release-prep infra pass. No app-behavior change.
