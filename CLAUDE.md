# CLAUDE.md

## Project
"Last Stop" — Multiplayer co-op escape room on a NY subway train.
Players solve puzzles car-by-car to reach the bomber before the train reaches its destination.
Built for the 2026 Vibe Jam. Deadline: 1 May 2026 @ 13:37 UTC.

See @docs/GAME_DESIGN.md for full game design document.

## Tech Stack
- Three.js for 3D rendering (no other 3D framework)
- Socket.io for real-time multiplayer
- Express.js backend
- Supabase (PostgreSQL) for persistent data (leaderboard, analytics)
- Vanilla JS with ES modules (import/export), NOT CommonJS (require)
- Deployed on Vercel (frontend) + separate WebSocket server

## Architecture
- Server authoritative: ALL puzzle state lives on the server. Clients are dumb renderers.
- Procedural puzzles: each session gets a random seed, puzzle values generated from seed
- server/gameState.js is the single source of truth for any game session
- Each car's puzzle is its own module in client/src/puzzles/ extending PuzzleBase
- Cars are loaded lazily (current car + next car only)
- Supabase handles ONLY persistent data (leaderboard). Game state during play is in-memory on the WebSocket server.
- Use @supabase/supabase-js client library on the server side only. Never expose Supabase keys to the browser client.

## Code Style
- ES modules everywhere
- Modular file structure: one responsibility per file
- Keep functions small and focused
- Use const by default, let when needed, never var
- Descriptive variable names (no single letters except loop counters)

## IMPORTANT — Vibe Jam Constraints
- MUST load almost instantly — NO loading screens, NO heavy assets
- MUST work in browser with NO login/signup (username prompt only)
- MUST be free to play
- Total initial bundle under 5MB
- Low-poly gritty aesthetic — lighting and atmosphere carry the visuals, NOT textures
- Three.js geometry should be simple. Flickering fluorescents, fog, and darkness make it look good.

## IMPORTANT — Gameplay Rules
- Every puzzle MUST be procedurally generated (no fixed answers across sessions)
- Every puzzle MUST require 2+ players to solve cooperatively
- Every car has exactly ONE hidden number for the meta-puzzle (not part of main puzzle)
- The train progress timer MUST always be visible and ticking — never break it
- Hint system: 3 tiers per car, each tier adds score penalty (+30s, +60s, +120s)

## Build Order
1. Train shell (geometry, lighting, movement, doors, windows)
2. Multiplayer (Socket.io, rooms, player sync)
3. Puzzles (one car at a time, Car 1 through Car 8)
4. Polish (sound, UI, leaderboard, ad panels, Vibe Jam widget)

## Commands
- `npm run dev` — starts both client and server in dev mode
- `npm run build` — production build
- Test multiplayer by opening multiple browser tabs to localhost

## Environment Variables
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key (server-side only, NEVER expose to client)
- Store in `.env` file, add `.env` to `.gitignore`

## Mistakes to Avoid
- Do NOT add large texture files or 3D model imports
- Do NOT put puzzle logic on the client — server validates everything
- Do NOT build multiple cars in one session — one car per focused session
- Do NOT hardcode puzzle answers — always derive from the session seed
- Do NOT expose Supabase keys or URL to the browser client — server-side only
- Do NOT call Supabase during gameplay — only on game completion (leaderboard write) and menu load (leaderboard read)
