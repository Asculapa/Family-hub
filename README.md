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
supabase/         config, migrations, pgTAP tests
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
| `pnpm web:export` | Web build smoke check |
| `pnpm db:reset` | Recreate the local database from migrations |
| `pnpm db:test` | pgTAP tests for RLS and RPCs |
| `pnpm db:types` | Regenerate `packages/data/src/database.types.ts` |

## Rules

- Add native dependencies with `npx expo install <pkg>` from `apps/mobile`.
- Screens get data only through `packages/data`, never Supabase or SQLite directly.
- Shared packages have no React Native or browser imports; platform code goes behind
  `.native.ts` / `.web.ts` files.
- Every table has RLS and a pgTAP test.
