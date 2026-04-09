# Creatorflow MVP (AI-Native CRM)

Minimal chat-first CRM MVP built with Next.js App Router, Supabase, and OpenAI.

## 1) Install and configure

```bash
npm install
cp .env.example .env.local
```

Set values in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `DEMO_USER_ID` (optional, useful before wiring auth)

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
