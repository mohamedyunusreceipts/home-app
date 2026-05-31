# Home

Shared home management app for couples. PWA built with Next.js 16, Supabase, and Google Drive integration.

## Prerequisites

- Node.js ≥20
- Docker Desktop (running, required for local Supabase)
- Supabase CLI: bundled as a dev dependency (use via `npx supabase …`)

## First-time setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local Supabase (one-time pull of Docker images, then ~5s):
   ```bash
   npx supabase start
   ```

3. Copy the printed `anon key` and `service_role key` into `.env.local`:
   ```bash
   cp .env.local.example .env.local
   # then edit .env.local with the values from `supabase start`
   ```

4. Apply database migrations:
   ```bash
   npx supabase migration up
   ```

## Development

```bash
npm run dev               # Next.js dev server at http://localhost:3000
npx supabase status       # show local Supabase URLs and keys
npx supabase stop         # stop local containers (preserves data)
npx supabase db reset     # drop + recreate local DB, re-apply migrations + seed
```

Supabase Studio (local DB UI): http://localhost:54323

## Testing

```bash
npm test                  # run all tests once
npm run test:watch        # watch mode
```

Integration tests run against the local Supabase instance. Make sure `supabase start` is running first.

## Project structure

```
/app                  Next.js App Router routes
/components/ui        ShadCN primitives (restyled)
/lib                  Shared utilities (supabase clients, env, etc.)
/supabase/migrations  Database schema, applied in numbered order
/tests                Vitest test suite
/docs/superpowers     Design specs and implementation plans
```

## Theme

Warm/cozy palette: terracotta (#C77B5C), sage (#7A9B7A), cream (#FAF6EF). Headings: Fraunces (serif). Body: Inter (sans).
