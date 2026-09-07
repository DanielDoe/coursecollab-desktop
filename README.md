# CourseCollab Desktop

Vite + React + Electron desktop shell. UI routes are bundled with Vite; API calls proxy to production (or a local Next.js API server during development).

Web source is synced from `v0-coursecollabv3` (read-only).

## Layout

```
coursecollab-desktop/
├── app/              route pages (from web, loaded by Vite router)
├── components/       UI modules (from web)
├── lib/              shared logic (from web)
├── src/              Vite entry, Next.js shims, client router
├── electron/         desktop shell
├── index.html        Vite HTML entry
├── vite.config.ts
└── package.json
```

## Sync from web

```bash
npm run sync:web
```

## Dev (browser first)

Use the Vite dev server in your browser while iterating on UI. Electron is optional and can spawn extra windows on reload — skip it until you are ready to test the packaged shell.

```bash
npm install
cp .env.example .env

npm run dev:vite
```

Open **http://127.0.0.1:5173/auth/welcome** (portal picker → university/login → dashboard).

### Optional: local API server

By default, `/api` requests proxy to production (`https://course-collab.com`). For a fully local stack:

```bash
# Terminal 1 — Next.js API + server routes
npm run dev:api

# Terminal 2 — set VITE_API_URL=http://localhost:3000 in .env, then:
npm run dev:vite
```

### Optional: Electron shell

When you want to test the desktop window:

```bash
npm run dev:desktop
```

## Build desktop installer

```bash
npm run build:desktop
```

Output: `release/`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev:vite` | **Primary dev** — Vite in browser at :5173 |
| `npm run dev:desktop` | Vite + Electron (use when testing the shell) |
| `npm run dev:api` | Next.js on :3000 (optional local API) |
| `npm run dev:electron` | Electron only (Vite must already be running) |
| `npm run build:renderer` | Production Vite bundle → `dist/` |
| `npm run build:desktop` | Vite build + Electron packager |
| `npm run sync:web` | Copy latest web app source |
