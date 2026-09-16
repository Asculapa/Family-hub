# Family Hub

pnpm 12 + Turborepo monorepo. Spec: `Family Hub — Technical Specification.md`. Commands and layout: `README.md`.

- The Expo app lives in `apps/mobile`; read `apps/mobile/AGENTS.md` before touching Expo APIs.
- pnpm settings go in `pnpm-workspace.yaml` (pnpm 12 ignores `.npmrc` settings). `nodeLinker: hoisted` is required for React Native.
- Before finishing: `pnpm typecheck && pnpm lint && pnpm test`; for schema changes also `pnpm db:reset && pnpm db:test`.
