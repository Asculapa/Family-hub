# Family Hub

Shared shopping lists, to-dos, calendar and live location for one household.
iOS and Android app built with Expo, backed by Supabase. See
[the technical specification](./Family%20Hub%20—%20Technical%20Specification.md).

## Layout

```text
apps/mobile/      Expo app (iOS + Android; web export used as a CI smoke check)
packages/core/    domain types, Zod schemas, role permissions
packages/data/    Supabase client, repositories, sync engine
packages/storage/ LocalStore interface (SQLite on native, IndexedDB on web later)
packages/ui/      shared design tokens and components
packages/i18n/    translations
supabase/         config, migrations, pgTAP tests, Edge Functions (send-push)
```

## Requirements

- Node 22 (`.nvmrc`) and pnpm 12 (`npm i -g pnpm@12`)
- Docker, for the local Supabase stack

## Getting started

```sh
pnpm install
pnpm db:start                          # local Supabase; prints the API URL and anon key
cp apps/mobile/.env.example apps/mobile/.env.local   # fill in the anon key
pnpm dev                               # Expo dev server
```

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm lint` | ESLint (Expo config) |
| `pnpm test` | Vitest unit tests in packages |
| `pnpm test:functions` | Unit tests for Edge Function helpers |
| `pnpm web:export` | Web build smoke check |
| `pnpm db:reset` | Recreate the local database from migrations |
| `pnpm db:test` | pgTAP tests for RLS and RPCs |
| `pnpm db:types` | Regenerate `packages/data/src/database.types.ts` |
| `pnpm --filter @family-hub/data test:integration` | Repository tests against local Supabase (needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `supabase status -o env`) |

## Local auth emails

Email confirmation is on (FR-1.2). Sign-up, magic link and password reset emails from the
local stack land in Mailpit at http://127.0.0.1:54324. Links open `familyhub://auth/callback`
(or `http://localhost:8081/auth/callback` in the web dev build). On a physical phone,
`127.0.0.1` in those links points at the phone, so use a simulator/emulator or set
`EXPO_PUBLIC_SUPABASE_URL` to your machine's LAN address.

## Rules

- Add native dependencies with `npx expo install <pkg>` from `apps/mobile`.
- Screens get data only through `packages/data`, never Supabase or SQLite directly.
- Shared packages have no React Native or browser imports; platform code goes behind
  `.native.ts` / `.web.ts` files.
- Every table has RLS and a pgTAP test.

## How the pieces fit

- **Offline sync** (`packages/data/src/sync`): lists, items, categories, events and event
  exceptions live in an on-device SQLite database. Writes apply locally, queue in an outbox and
  replay in order; realtime and pulls bring in other members' changes. Last write wins per row.
- **Notifications**: database triggers and a per-minute job write `notification_queue`
  (assignments, reminders, "Where are you?", new members, batched list changes), applying each
  user's preferences. The `send-push` Edge Function drains it to Expo Push; quiet hours deliver
  silently.
- **Location**: sharing is opt-in via `set_location_sharing()`; the app's background task buffers
  positions and uploads them with `ingest_locations()` at most once a minute. Trails are kept
  24 hours, check-ins 7 days.

Native features (push, background location, maps, Face ID, Apple/Google sign-in) need a
development build (`eas build --profile development`), not Expo Go.

## Going live checklist

1. `npx eas-cli@latest init` in `apps/mobile`, then set `EAS_PROJECT_ID` (push tokens need it).
2. Push credentials: `eas credentials` for APNs (iOS) and an FCM key (Android).
3. Supabase staging/production projects: `supabase link`, `supabase db push`,
   `supabase functions deploy send-push`, and optionally `supabase secrets set EXPO_ACCESS_TOKEN=...`.
4. Let the database call the function (run once per project, in the SQL editor):
   ```sql
   insert into private.settings values
     ('functions_url', 'https://<project-ref>.supabase.co/functions/v1'),
     ('service_role_key', '<service role key>');
   ```
5. Auth: enable email confirmations, add redirect URLs (`familyhub://**`, `https://familyhub.app/**`),
   and configure the Apple and Google providers; then set `EXPO_PUBLIC_APPLE_SIGN_IN=1`,
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME`.
6. Maps on Android: `GOOGLE_MAPS_ANDROID_API_KEY`.
7. Universal links for `familyhub.app` (apple-app-site-association, assetlinks.json).
8. Store requirements: privacy policy URL, privacy labels, background location justification
   (App Store review notes, Play Console declaration and video), demo account.
