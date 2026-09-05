# CourseCollab Desktop

A clean Electron foundation for the CourseCollab desktop application.

## Stack

- Electron
- React and TypeScript
- Vite
- Tailwind CSS
- ESLint and Prettier
- electron-builder for macOS and Windows packaging

## Structure

- `electron/main.ts` — native window lifecycle and narrowly scoped IPC handlers
- `electron/preload.ts` — secure context-isolated bridge
- `src/` — React renderer and design foundation
- `dist-electron/` — compiled Electron process output
- `release/` — packaged application artifacts

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm typecheck
pnpm lint
pnpm build
```

The build command creates the renderer, compiles the Electron process, and prepares macOS and Windows installer targets. Code signing, notarization, auto-updates, and credentials are intentionally not configured yet.

## Security architecture

The main process owns native desktop responsibilities. The preload process exposes only the typed, read-only `getAppVersion()` API through `contextBridge`. The renderer has `contextIsolation` enabled, `nodeIntegration` disabled, and sandboxing enabled; it cannot directly access Node APIs.

This repository currently contains only the CourseCollab Desktop application foundation. Product functionality will be implemented incrementally.
