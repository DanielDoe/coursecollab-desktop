# CourseCollab Desktop — Native Notifications

Native OS notifications for the CourseCollab Electron app: macOS Notification Center, Windows Action Center, Linux desktop alerts, system tray, sounds, grouping, quiet hours, and background sync.

## Features

| Feature | Description |
|---------|-------------|
| **OS banners** | Main-process `electron.Notification` tied to the app |
| **Sounds** | Default OS ping (macOS `Ping`, Windows toast sound); toggle in tray menu |
| **Grouping** | Bursts within 2.5s collapse into one summary per category |
| **Group by course** | Optional grouping key includes course from notification link |
| **Notification actions** | macOS: **Mark as read**; message types also support inline **Reply** |
| **Quiet hours** | Hold OS banners during configured hours (default 22:00–07:00) and replay them as one summary when the window ends |
| **Tray preview** | Recent unread titles in tray menu (last 5) |
| **Background sync** | Main process polls while app is in tray (when enabled) |
| **Launch at login** | Start hidden in tray so notifications continue after reboot |
| **Push when quit** | Device registration API + `desktop_push_devices` table; APNs/WNS tokens wired when credentials are added server-side |
| **Dock badge** | Unread count on macOS/Linux dock; taskbar overlay badge on Windows |
| **Minimize to tray** | Closing the window hides to tray instead of quitting |
| **Deep links** | Click notification → focus app → navigate in SPA |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Renderer (React)                                            │
│  • Poll student / faculty / admin notification APIs          │
│  • deliverNewDesktopNotifications() with groupKey + course   │
│  • registerDesktopNotificationSync() → main-process poll     │
│  • DesktopNotificationBridge → navigate + mark-read actions  │
└────────────────────────────┬─────────────────────────────────┘
                             │ IPC
┌────────────────────────────▼─────────────────────────────────┐
│  Electron main process                                       │
│  • Grouping debounce (2.5s per groupKey)                     │
│  • Quiet hours gate                                          │
│  • macOS notification actions (mark read / reply)            │
│  • Tray menu + unread preview ring buffer                    │
│  • Background sync (net fetch while in tray)                 │
│  • Launch at login (openAsHidden)                            │
└──────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│  Server (future push)                                        │
│  POST /api/desktop/push-token → desktop_push_devices         │
│  APNs (macOS) / WNS (Windows) when push_token is supplied    │
└──────────────────────────────────────────────────────────────┘
```

## Grouping

When **Group notifications** is enabled (default):

1. Each notification includes `groupKey` (e.g. `student:announcement:course:123`) and `groupLabel` (e.g. `ELEG 2026 — announcements`).
2. **Group by course** (default on) appends a course segment parsed from the notification `link` or faculty `source_name`.
3. Items arriving within **2.5 seconds** in the same group batch into one OS alert.

## Quiet hours

- Toggle **Quiet hours** in the tray menu.
- Default window: **22:00–07:00** (local time).
- During quiet hours, banners are **held, not dropped**. Items still appear in the
  tray preview and still update badge counts; when the window ends (or quiet hours
  is switched off) they are replayed as a single "N notifications while you were
  away" summary. Holding rather than dropping matters because the renderer has
  already advanced its seen-cursor by the time the main process sees the alert.
- Times are stored in `{userData}/desktop-notification-preferences.json`.

## Notification actions (macOS)

- **Mark as read** — sends `notification:action` IPC → renderer PATCHes the portal notification API.
- **Reply** — available for `message` type notifications; inline reply focuses the app and opens the thread link.

Windows/Linux do not expose action buttons via Electron today; click-to-open still works.

## System tray

**Tray menu:**
- Show CourseCollab
- Unread count
- Recent notifications (up to 5, clickable)
- Notification sounds ☑
- Group notifications ☑
- Group by course ☑
- Quiet hours ☑
- Background sync (tray) ☑
- Launch at login (stay in tray) ☑
- Minimize to tray on close ☑
- Quit CourseCollab

## Push when app is fully quit

True push while the process is not running requires platform credentials:

| Platform | Provider | Status |
|----------|----------|--------|
| macOS | APNs | Schema + device registration ready; send path TBD |
| Windows | WNS | Schema + device registration ready; send path TBD |

**Available today without APNs/WNS:**
- **Launch at login** — app starts hidden in tray and resumes polling.
- **Background sync** — main process fetches notification feeds while the app runs in tray.
- **Device registration** — `POST /api/desktop/push-token` stores `{ device_id, owner_kind, owner_id, platform }`.

When APNs/WNS tokens are supplied, the same row accepts `push_token` and `push_provider`.

## IPC API

`window.courseCollabDesktop`:

| Method | Purpose |
|--------|---------|
| `showNotification(payload)` | Show native alert (supports `notificationId`, `portal`, `supportsReply`) |
| `setBadgeCount(count)` | Dock badge + tray tooltip |
| `setNotificationSyncContext(context \| null)` | Register main-process background poll |
| `getDeviceId()` | Stable desktop device UUID |
| `getNotificationPreferences()` | All tray toggles including quiet hours |
| `onNotificationNavigate(handler)` | Notification click → route |
| `onNotificationAction(handler)` | Mark read / reply from macOS actions |

## Testing

```bash
npm run dev:desktop
```

1. Sign in and trigger several notifications quickly (same course + type) → one grouped banner.
2. Right-click tray → enable **Quiet hours** → no banners until disabled or outside window.
3. Trigger notifications → tray **Recent notifications** lists titles.
4. macOS: long-press notification → **Mark as read** → item clears on next poll.
5. Enable **Launch at login** → log out/in → app should appear in tray without a visible window.
6. Close window → app stays in tray; background sync continues if enabled.

Restart Electron after `electron/` changes.

## Notification ownership

`instructor_notifications` originally had no owner column, so every read returned
every instructor's rows. Notifications now carry `instructor_id` and/or `course_id`
(`migrations/add-instructor-notification-ownership.sql`, applied at runtime by
`lib/ensure-instructor-notification-ownership.ts`).

- `createInstructorNotification` requires `instructorId` and/or `courseId`. A row
  with neither is logged as a warning and appears in **no** instructor's feed.
- Reads, mark-read, mark-all-read and Expo push are all scoped to the caller.
- Rows created before the migration carry no owner and are not shown. The
  migration includes a commented backfill for single-instructor deployments.

## Background sync authentication

The main process polls with `session.fromPartition('persist:coursecollab').fetch()`,
not Node's global `fetch`. Node's fetch has no cookie jar and no access to the
session, so it could never satisfy the server's session check, and every background
poll returned 401 silently.

The sync context registered from the renderer therefore carries the desktop refresh
token (`x-cc-refresh`) alongside the identity headers, and the main process captures
rotated tokens from poll responses so the stored one does not go stale.

## Files

| File | Role |
|------|------|
| `electron/notifications.ts` | OS alerts, grouping, actions, quiet hours gate |
| `electron/tray.ts` | Tray icon, preview, preferences menu |
| `electron/quiet-hours.ts` | Quiet-hours evaluation |
| `electron/notification-store.ts` | Recent items for tray preview |
| `electron/background-sync.ts` | Main-process polling while in tray |
| `electron/push-registration.ts` | Device ID + launch at login |
| `electron/preferences.ts` | Persisted notification settings |
| `lib/desktop-notification-groups.ts` | Group key/label + course parsing (**source of truth**) |
| `electron/notification-groups.ts` | Generated copy for the main process — do not edit; run `npm run sync:notification-groups` |
| `lib/create-instructor-notification.ts` | Insert + ownership scope fragment |
| `lib/ensure-instructor-notification-ownership.ts` | Runtime column guard |
| `lib/desktop-notifications.ts` | Renderer integration |
| `lib/desktop-notification-actions.ts` | Mark-read handler for IPC actions |
| `lib/desktop-push-registration.ts` | Register device with API |
| `app/api/desktop/push-token/route.ts` | Device registration endpoint |
| `components/desktop/DesktopNotificationBridge.tsx` | Click + action routing |

## Future work

- macOS code signing and notarization (`build.mac.identity` / `build.mac.notarize`
  are unset, so builds are ad-hoc signed; notification action buttons are
  unreliable on unsigned builds)
- Server-initiated APNs/WNS delivery using stored `push_token`
- Per-type custom sounds
- Configurable quiet-hour times from tray UI (currently fixed defaults in prefs file)
