# Hosted multiplayer backend — architecture

`server/index.js` is a **reference relay**: one process, no database, one
`Map` of open sockets, re-broadcasts every message to everyone else in the
same room string. It's enough to see ghost cars on a LAN or a small private
deploy, but it has three real gaps if this game ever needs a backend you'd
call "hosted":

1. **No persistence** — rooms are just a string every client happens to
   send; restart the process and every room "disappears" (there was never
   anything to remember).
2. **No matchmaking** — players type a room code into a text box. Fine for
   friends, unworkable for "find me a game."
3. **No horizontal scaling** — one process holds every socket in memory,
   so it's a single point of failure and a hard ceiling on concurrent
   players.

This doc designs the next version. It's a design only — no server code
ships with it (see the project roadmap in the main `readme.md`) — so an
engineer can pick it up and build against something concrete.

## Non-goals

Worth stating up front, because they simplify everything below:

- **Not gameplay-authoritative.** Circuit City's multiplayer is a cosmetic
  overlay — other players render as translucent "ghost" cars, there's no
  shared physics, no PvP hit registration, no shared world state that
  needs to be consistent. That means no server-side physics simulation,
  no lag compensation, no anti-cheat beyond basic abuse prevention.
- **Not competitive.** No ELO/skill rating, no ranked matchmaking. "Find me
  a room with people in it" is the entire matchmaking requirement.
- **Not massive-scale.** Ghost-car state is ~10 small messages/second per
  player. Realistic target is hundreds of concurrent players, not
  hundreds of thousands — don't over-build past that.

## Current protocol (keep this compatible)

The client (`sources/Game/Server.js`, `sources/Game/Multiplayer.js`) speaks
msgpack-encoded JSON-like objects over one WebSocket per session:

| `type`    | Direction | Payload |
| --- | --- | --- |
| `mpJoin`  | client → server | `{ room }` |
| `mpState` | client → server, then relayed | `{ room, x, y, z, rotationY, paint }`, sent ~6.7×/sec |
| `mpLeave` | server → clients | `{ room, uuid }`, sent on disconnect |
| `chat`    | either direction | `{ room, text }` |

Everything below is designed to be a **drop-in replacement gateway** that
still speaks this protocol, so the client doesn't need to change — only
`VITE_SERVER_URL` (and a new matchmaking endpoint, see below) point
somewhere smarter.

## Proposed architecture

```
                    ┌─────────────────┐
 client ── wss:// ──▶  gateway node A  │──┐
                    └─────────────────┘  │
                    ┌─────────────────┐  │      ┌───────────┐
 client ── wss:// ──▶  gateway node B  │──┼─────▶│   Redis   │  pub/sub fan-out
                    └─────────────────┘  │      │ (ephemeral │  between gateway
                    ┌─────────────────┐  │      │  presence) │  nodes, so players
 client ── wss:── ──▶  gateway node N  │──┘      └───────────┘  in the same room
                    └─────────────────┘                          can land on
                             │                                   different nodes
                             ▼
                    ┌─────────────────┐
                    │  Room service    │──▶ Postgres (or SQLite for small deploys)
                    │  (HTTP API)      │    rooms, room_members, chat history
                    └─────────────────┘
```

- **Gateway nodes** — stateless WebSocket terminators (this is what
  `server/index.js` becomes). Any node can serve any player. On a message,
  a node publishes to a Redis channel named for the room; every node
  subscribed to that channel (i.e. hosting a member of that room)
  re-broadcasts to its own local sockets. This is the standard "Redis
  pub/sub as a broadcast bus" pattern for scaling WebSocket fan-out
  horizontally — no gateway node needs to know about sockets it doesn't
  hold.
- **Room service** — a small HTTP API (not on the hot path of every
  position update) that owns room *metadata*: creating rooms, listing
  public rooms with space, matchmaking, and issuing short-lived join
  tokens. Backed by a real database, because this is the part that needs
  to survive a restart.
- **Redis** — ephemeral only. Pub/sub for cross-node fan-out, plus
  optionally a `room:{code} → Set<uuid>` key (TTL'd) for "who's here right
  now" without hitting Postgres on every join/leave.

For a first deploy this can all be **one process + one Postgres +
one Redis** (e.g. a single Fly.io machine or a small VPS) — the
gateway/room-service split is a logical separation, not a requirement to
run them on different hosts. Split them out only once one gateway node's
socket count is the actual bottleneck.

## Data model

```sql
create table rooms (
    id            uuid primary key default gen_random_uuid(),
    code          text unique not null,        -- the human-typed room code, e.g. "havoc42"
    mode          text not null default 'free', -- reserved: 'free' | 'race' | future modes
    region        text,                          -- e.g. 'us-east', for matchmaking locality
    capacity      int  not null default 16,
    is_public     boolean not null default true, -- discoverable by matchmaking vs join-by-code only
    created_at    timestamptz not null default now(),
    last_active_at timestamptz not null default now()
);

create table room_members (
    room_id    uuid not null references rooms(id) on delete cascade,
    player_id  uuid not null,          -- same uuid the client already generates client-side
    joined_at  timestamptz not null default now(),
    left_at    timestamptz,            -- null while connected
    primary key (room_id, player_id, joined_at)
);

-- Optional: only add this if persistent chat history (backfill on join) is wanted.
-- The current reference relay explicitly does NOT do this (see server/README.md).
create table chat_messages (
    id         bigserial primary key,
    room_id    uuid not null references rooms(id) on delete cascade,
    player_id  uuid not null,
    text       text not null,
    created_at timestamptz not null default now()
);
-- Retention: prune rows older than e.g. 24h with a scheduled job — this is
-- flavor text, not a record anyone needs kept.
```

`room_members.left_at` being null is the "who's currently connected" query
for a room; a periodic sweep can close out rows for sockets that vanished
without a clean `mpLeave` (crash, network drop) once their presence key
expires in Redis.

## Matchmaking

Circuit City doesn't need skill-based matchmaking — "put me somewhere with
people in it" is the whole ask. Proposed HTTP endpoint:

```
POST /api/rooms/quick-match
  body: { region?: string }
  →  { code, wsUrl, joinToken }
```

Algorithm (v1, deliberately simple):
1. Query `rooms` for public rooms in the requested region with
   `member_count < capacity`, ordered by `member_count desc` (fill rooms
   before spawning new ones — keeps players together instead of scattering
   them one-per-room).
2. If one exists, return it.
3. Otherwise create a new room row and return that.

`joinToken` is a short-lived signed token (HMAC, a few minutes' expiry)
binding `{ playerId, roomId }` — the gateway validates it on `mpJoin`
instead of trusting a bare client-supplied uuid. This is the minimum bar
to stop "connect and claim to be anyone" abuse; it is **not** an auth
system (no accounts, no passwords) and shouldn't be sold as one.

Explicit room codes (the current "Join room" text box) keep working
unchanged — `quick-match` is additive, not a replacement for playing with
friends by code.

## What changes vs. the current reference relay

- Add a room-service HTTP API (new) alongside the existing WS gateway.
- Add `joinToken` issuance + gateway-side verification (new — closes the
  "no auth" gap called out in `server/README.md`).
- Add basic per-connection rate limiting at the gateway (e.g. drop a socket
  that sends >20 msgs/sec — `mpState` at ~6.7/sec leaves headroom for chat
  bursts) and payload size/shape validation before re-broadcasting (closes
  the "no rate limiting, no message validation" gap in the same doc).
- Swap the in-memory `Map` for Redis pub/sub so more than one gateway
  process can run.
- Everything else — message shapes, client code, `Multiplayer.js` — stays
  as-is.

## Hosting

Not a code decision, but worth naming concretely since "hosted" implies
picking somewhere to run this: a single small instance on Fly.io, Railway,
Render, or a plain VPS with a managed Postgres + Redis addon is enough for
the target scale above. None of these require the multi-region complexity
in the diagram on day one — start with one gateway node, add more only
when connection count on that node actually becomes the bottleneck.

## Explicitly out of scope

- Server-authoritative physics / anti-cheat beyond join-token auth (not a
  competitive game mode)
- Voice chat
- Cross-region matchmaking / regional replication
- Accounts, cloud saves (that's the *separate* roadmap item — see
  `readme.md` → "Cloud save / accounts" — this doc's `player_id` is still
  the client-generated, localStorage-held uuid, not a login)
