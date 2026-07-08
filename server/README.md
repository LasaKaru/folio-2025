# Circuit City — reference multiplayer relay

The game's multiplayer feature (`sources/Game/Multiplayer.js`) talks over the
same WebSocket connection used for whispers and the circuit leaderboard
(`sources/Game/Server.js`). Without a server configured, multiplayer simply
stays offline — nothing else in the game requires it.

This folder is a minimal reference implementation you can run yourself: a
broadcast relay that re-sends every message it receives to every other
connected client. It doesn't parse or store game state, so it's a few dozen
lines — good enough to actually see other players' ghost cars, not a
production backend.

## Run it

```bash
npm install ws
node server/index.js
```

Then point the client at it in your `.env`:

```
VITE_SERVER_URL=ws://localhost:8080
```

## What it does and doesn't do

- Relays every message to every other connected client, as-is
- Tracks each socket's `uuid` (sent by the client on every message) so it can
  announce `mpLeave` when someone disconnects
- Has **no** auth, rate limiting, message validation, or persistence

If you deploy this beyond a LAN or a small private group, put it behind
something that adds at least connection limits and origin checks — this
reference server trusts every message it receives.

## Extending it

The client also sends/receives whisper and circuit-leaderboard messages
over the same socket (see `sources/Game/World/Whispers.js` and the circuit
area code) — this relay happily re-broadcasts those too, but since it holds
no state, a client that connects after others have already posted whispers
won't get an `init` backfill. If you want that, or to persist a leaderboard,
you'll need to add real handling for those `type` values server-side.
