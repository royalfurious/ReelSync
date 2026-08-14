# ReelSync (Watch Party App)

A monorepo for a private watch-party app: a Next.js frontend, a Fastify backend, shared TypeScript contracts, a Drizzle/Postgres schema, and local infrastructure for Redis, LiveKit, and TURN.

## Features

- Room creation, join-by-link or join-by-code, host/guest roles, and host transfer
- Real-time room state, chat, and playback sync over Socket.IO
- Host-side local video file playback (MP4/WebM/MOV/MKV where the browser can decode it) with a custom playback control center
- LiveKit-based WebRTC transport so participants receive the host's stream live
- Custom auth (register/login/logout/session) with cookie-based sessions
- Postgres-backed persistence for rooms, members, and chat (falls back to in-memory if `DATABASE_URL` is not set)
- Room permissions (who can control playback / send chat) and a host dashboard with participants, chat, and recent activity

## Project structure

```
apps/
  frontend/   Next.js App Router UI
  backend/    Fastify API + Socket.IO realtime server
packages/
  shared/     Shared types, permissions, and playback logic
  db/         Drizzle schema and DB client
infra/
  livekit.yaml  Local LiveKit server config
```

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres, Redis, LiveKit, and a TURN server locally)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env
   ```

   At minimum, set `DATABASE_URL` if you want persistence (otherwise rooms are in-memory only), and keep the LiveKit dev keys as-is for local use.

3. Start local infrastructure:

   ```bash
   docker compose up -d
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

   This runs the frontend on `http://localhost:3000` and the backend on `http://localhost:3001`.

## LiveKit notes (local dev)

- `docker-compose.yml` publishes the LiveKit signal port (`7880`), RTC-over-TCP port (`7881`), and the RTC media UDP range (`50000-50100`). All three must be published or WebRTC connections will fail with `could not establish pc connection`.
- `infra/livekit.yaml` sets `node_ip: 127.0.0.1` so ICE candidates resolve correctly under Docker Desktop when testing from the same machine. If you test across multiple devices on your LAN, change this to your machine's LAN IP.

## Scripts

- `npm run dev` — starts the frontend and backend concurrently.
- `npm run dev:frontend` / `npm run dev:backend` — start one side only.
- `npm run build` — builds all workspace packages.
- `npm run lint` — runs ESLint.
- `npm run typecheck` — runs TypeScript project references.
- `npm run test` — runs Vitest unit tests.
- `npm run test:e2e` — runs Playwright end-to-end tests.

## Notes

- Only upload media you own or are authorized to distribute — the app is intended for private watch parties among people who already have the rights to share the content with each other.
