# Creatorflow MVP (AI-Native CRM)

Minimal chat-first CRM MVP built with Next.js App Router, Supabase, and OpenAI.

## 1) Install and configure

```bash
npm install
cp .env.example .env.local
```

Set values in `.env.local` (see `.env.example`).

## Production (e.g. Vercel)

1. Add the same environment variables in the Vercel project settings (Production / Preview as needed).
2. In Supabase, run migrations under `supabase/migrations/` (including `google_oauth_tokens` if you use Gmail).
3. Set `GOOGLE_REDIRECT_URI` to `https://<your-domain>/api/google/callback` and add that URL in the Google Cloud OAuth client.
4. Set `INBOUND_WEBHOOK_SECRET` before exposing webhook routes.
5. In Supabase **Authentication → URL configuration**, add your production site URL and redirect URLs (including `/auth/callback`).
6. Build: default Next.js on Vercel (`next build`); no custom output directory.

## 2) Create database schema

Run `supabase/schema.sql` in the Supabase SQL editor.

## 3) Run app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Node version

If you see dev-server chunk errors like `Cannot find module './331.js'`, use **Node 22 LTS** (see `.nvmrc`), or run the dev server with Turbopack via `npm run dev` (default).

## 4) Test chat commands

Try examples:
- "Create a contact for Nike"
- "Log a deal called Nike Summer Campaign worth 2500"
- "Set a follow up for 2026-04-03 and remind me to send rate card"
- "Show me insights"

## 5) API routes (optional)

- `POST /api/chat`
- `GET /api/contacts`
- `GET /api/deals`
- `GET /api/tasks`
- `GET /api/timeline`

Main flow uses a Server Action in `app/actions/chat.ts`.
