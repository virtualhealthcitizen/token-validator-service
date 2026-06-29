# Burndown — token-validator-service

One validated backlog item per cycle, shipped via a merged PR. `← next` marks the
next item. Newest-first **Burndown Log** at the bottom. Mirrors the jm/ffmpeg-util
conventions (commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).

## What exists today
A stateless **Flask** microservice: `POST /api/validate-token` takes `{ "token": "<google oauth access token>" }`,
calls Google's `oauth2/v3/tokeninfo`, and returns `{ valid, token_info }` (200) or
`{ valid: false, error }` (400). Containerized (Docker → Cloud Run), Postman/Newman
collection as the integration suite. **No UI** — validation is curl/Postman only.

---

## Initiative: "Token Validator" — an Electron desktop UI

A cross-platform desktop app that puts a friendly face on the validation service: paste a
token, validate, and read the decoded claims — no curl, no Postman. Mirrors the proven
**jm / ffmpeg-util** desktop pattern (Electron + Vite + React + TypeScript, `loadFile(dist)`
in prod, `electron:dev` for HMR, build-first `electron` script so it never serves a stale
`dist` — see jm's #104 lesson).

### Architecture decisions (decide in M0)
- **Stack:** Electron + Vite + React + TS, matching the sibling apps (shared muscle memory,
  reuse the build/deploy gates). Renderer is a single view; no router needed initially.
- **How the renderer reaches the validator:** two modes —
  1. **Remote**: POST to a configurable service URL (the deployed Cloud Run instance).
  2. **Direct**: call Google `tokeninfo` straight from the main process (no service needed).
  Default to Remote with a settings field; keep the token off disk (never persist tokens).
- **Security:** `contextIsolation: true`, `nodeIntegration: false`, a narrow preload bridge
  (`validateToken(token)` over IPC) so the renderer never holds Node/network creds. Tokens
  are secrets — never log them, never write them to disk, scrub from memory after a check.
- **Packaging:** out of scope until M3 (electron-builder); dev-run via npm scripts first.

### Milestones / backlog

**M0 — Scaffold & decisions**
- [ ] Decide Remote-vs-Direct default + settings shape (above). `← next`
- [ ] Scaffold Electron + Vite + React + TS (copy jm's `electron/main.js` + `preload.cjs`
      pattern; build-first `electron` script; `electron:dev` HMR).
- [ ] Hard gate wired: `npm run build` (tsc --noEmit + vite build) + a placeholder `npm test`.

**M1 — Core validate flow**
- [ ] Paste-token textarea + "Validate" button → calls the service, shows valid/invalid.
- [ ] IPC bridge `validateToken(token)` in preload; main process performs the request
      (Remote mode) so CORS/secrets stay out of the renderer.
- [ ] Render `token_info` claims in a readable table (scope, aud, exp, email, …); humanize
      `exp` (absolute + relative "expires in"). Clear error state for 400/network.

**M2 — UX polish**
- [ ] Light/dark theme (`data-theme`, prefers-color-scheme default) mirroring jm's tokens.
- [ ] Copy-claims-as-JSON; "clear" wipes the token from state; never persist the token.
- [ ] Settings: service URL (Remote) or Direct toggle; remember the *mode*, never the token.
- [ ] Keyboard: Enter-to-validate, Esc-to-clear; loading + cancel for in-flight requests.

**M3 — Hardening & ship**
- [ ] Vitest for the claim-formatting/expiry pure helpers; gate on green.
- [ ] electron-builder packaging (win/mac/linux) + icon; size budget.
- [ ] README: screenshots + a `demo.gif` (the desktop UI), wired for the jm showcase
      demo-media pipeline (drop `demo.gif` at repo root → jm `refresh-data.mjs` picks it up).
- [ ] Decide repo layout: keep the desktop app in this repo under `desktop/`, or split to a
      dedicated `token-validator-desktop` sibling. (Lean: `desktop/` here to keep API+UI together.)

**Later / ideas**
- [ ] Batch validate (paste many tokens, table of results).
- [ ] Decode-only mode for JWT-style tokens (offline), clearly separated from live tokeninfo.
- [ ] History of *results* (never tokens) for the session only.

---

## Burndown Log (newest first)
- 2026-06-28: seeded this burndown + the Electron desktop-UI initiative (M0–M3 + ideas). No code yet.
