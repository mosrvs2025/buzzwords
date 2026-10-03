# Buzzwords

A shout-it-out word party game for the web. Phones are personal controllers and a TV (or any browser) is the stage.

## Play
- **Host:** open the site, tap *Host a game* and share the 4-letter code, link or QR code.
- **Join:** open `/room/CODE` on a phone. No accounts and no install (it's also an installable PWA).
- **TV:** open `/room/CODE/display` on a smart TV browser, a laptop on HDMI, a cast tab or AirPlay. It never receives secret words.
- 4+ players are split into balanced teams automatically (4–5 → 2 teams, 6–7 → 3, 8+ → 4). The host can shuffle or move players.
- On each turn one describer gets about 10 secret cards and 60s. Teammates shout guesses. The **other team also sees the word** and can slam **BUZZ** if the describer says it.
- After each turn the words are revealed, the describer can fix mis-taps, and the team banks its points. Teams take turns until everyone has described. Then you get a podium, awards and a rematch.

Modes: **Classic**, **No-Go Zone** (forbidden clue words), **Blitz** (30s; skips cost points). Modes are data in `shared/modes.ts`.
Decks: 6 built-in decks, the room's anonymous **Word Jar**, and custom decks from the **Deck Studio** (`/decks`). The studio can generate a deck with AI when `ANTHROPIC_API_KEY` is set.

## Architecture
- `shared/looks.ts`: avatar parts catalog + unlock rules (earned by games/wins; `pass` items reserved for a future shop). Rendered as SVG in `client/src/Avatar.tsx`.
- Voice: opt-in WebRTC mesh (`client/src/voice.ts`), signaled over the game socket. Each phone detects its own talking and broadcasts it, so every screen (including the TV) highlights who is speaking. Set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` for strict networks.
- `shared/engine.ts`: the game rules as a pure reducer (`applyAction`, `tick`) plus `projectView`. `projectView` builds a separate view for each device: the word goes only to the describer and to judges, and it never goes to teammates or the display. This is where cheating prevention lives.
- `server/`: one Node process with HTTP and WebSockets (`ws`). The server is authoritative for state, the timer and scoring. Each player gets a seat token, so reloading, sleeping or dropping offline brings you back to the same seat. Rooms are saved as JSON snapshots (`DATA_FILE`) so they survive restarts.
- `client/`: React + Vite. Clocks are synced to the server so every timer agrees. Sound effects are synthesized (no assets). Haptics, swipe and keyboard controls are included.

## Deploying
**Vercel (zero config):** just deploy. Vercel can't run a long-lived WebSocket server, so the app switches to *peer mode*: the host's browser runs the room (the same `shared/hub.ts` code as the server) and other devices connect to it over WebRTC, using PeerJS's free public signaling service. The host's tab must stay open; if the host refreshes, the room is restored from their device. `api/` holds the Vercel functions for AI decks (`ANTHROPIC_API_KEY`) and voice ICE (`TURN_*`).

**Best (dedicated server):** deploy this repo as a Node service (Render, Fly.io, Railway) with `npm run build && npm start`. Then either use that URL directly, or keep the Vercel frontend and set `VITE_SERVER_URL=https://your-server` in Vercel. Rooms then survive the host leaving and are saved to disk.

Optional: `VITE_PEER_HOST/PORT/PATH/SECURE` (self-hosted PeerJS server), `VITE_TURN_URL/USERNAME/CREDENTIAL` (TURN for peer mode on strict networks).

## Run
```
npm install
npm run dev        # server :8787 + vite :5173
npm run build && npm start   # production on $PORT (default 8787)
npm test           # engine unit tests
npm run e2e        # 5 real browsers + TV play a full match (after build)
# peer mode (as on Vercel): build with VITE_PEER_HOST=127.0.0.1 VITE_PEER_PORT=9000 VITE_PEER_PATH=/ VITE_PEER_SECURE=false, then E2E_MODE=peer npm run e2e
```
Deploy it anywhere that runs a long-lived Node process with WebSockets (Fly.io, Render, Railway). Mount a volume for `DATA_FILE`.
