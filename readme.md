# Circuit City

An open-world neon driving game by HelaO2 Studio: on-foot shooter combat, a 10-chapter story campaign, a truck upgrade economy, side activities, local multiplayer, secrets to find and one very bouncy truck.

Built as a heavily remixed edition of [Bruno Simon's folio-2025](https://github.com/brunosimon/folio-2025) (MIT license) — recolored to a neon night-city vibe and expanded into a full game.

## Feature overview

- **Full recolor** — retinted model palette (`scripts/retheme-palette.js`), neon day cycles, terrain, trees, grid and UI
- **On-foot hero** — press `G` to step out of the truck and explore on foot: walk/sprint/jump, camera-relative controls, a health bar with regen, and a "wasted" respawn when the raiders get you
- **First & third person** — press `C` to switch to first-person (mouse-look on foot, hood cam while driving), press again for the classic camera
- **Shooter combat** — blaster (`X` / left click), plus shotgun, rocket launcher and melee once unlocked at the Garage; weapon skins, drive-by shooting, hit flashes, kill rewards
- **Story campaign** — 10 chapters across two rival factions (Havoc raiders, Enforcers), ending in a final boss. Clear a camp to earn credits and unlock the next chapter; progress is saved. Finishing the campaign triggers a **Victory** screen and records your time on the local leaderboard (Menu → Credits)
- **Boss Rush** — the 👑 HUD button fights every story boss back-to-back for a big payout
- **Enemies** — Havoc raiders (melee) and Enforcers (ranged) guard camps, chase on sight, and now also shoot/bash the **truck** if you drive through slowly — watch the vehicle health bar
- **Garage economy** — press `V` to spend credits on truck upgrades, weapon unlocks, cosmetics (paints/outfits/skins), and **truck repairs**
- **Havoc Nights** — a wave-based horde survival mode based at your compound
- **Missions & side activities** — 13 missions (checkpoints, orb collection, timed deliveries), plus taxi fares, stunt jumps and rampage timers
- **Daily challenge** — one rotating objective a day (drive/kill/mission-based), shown in the HUD, for a credit bonus
- **Secrets** — a hidden door tucked behind the map's waterfall unlocks an exclusive truck paint, and 6 collectible eggs are scattered around the island
- **Citizens & wildlife** — pedestrians, wandering deer near the tree groves, and small bird flocks circling a few landmarks
- **Three home bases** — Havoc Compound, Northside Garage and Old Port Yard, each walled with watchtowers, a helipad and its own respawn point
- **Bigger world** — villages, a downtown skyline, a shop strip, ponds, a waterfall, shore stones and many tree groves
- **Multiplayer** — a lightweight client (`Multiplayer.js`) renders other connected players as ghost cars, with room codes (Menu → Multiplayer, "Join room") and live text chat; ships with a self-hostable reference relay server (`server/`)
- **New options** — citizens on/off, Neon/Classic color theme, mission HUD toggle, volume, look sensitivity, difficulty
- **Rebranded** — HelaO2 Studio branding, splash screen, credits page with Support/Follow links

### Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | Drive (or walk, on foot) |
| `SHIFT` | Boost (driving) / Sprint (on foot) |
| `SPACE` | Jump |
| `G` | Get out of / into the truck |
| `C` | Toggle first / third person camera |
| `X` or left click | Shoot the equipped weapon |
| `Q` | Cycle weapons (once unlocked) |
| `V` | Open the Garage |
| `M` | Open the map (fast-travel pins for every district and base) |
| `ENTER` | Interact (secret door, easter eggs, NPCs) |
| `R` | Respawn |

The in-game HUD also shows contextual hints for whichever mode you're in (driving vs. on foot), and the full list is always in **Menu → Controls**.

### Secrets

- **Secret vehicle paint** — find the hidden door behind the map's waterfall (far west) and interact with it to unlock "Prototype X", an exclusive Garage paint job
- **Egg hunt** — 6 eggs are tucked around the island (village dock, downtown, compound gate, shop strip, shore stones, waterfall pool); driving or walking near one collects it automatically. Find all 6 for the "Egg hunter" achievement

> Note: `static/palette.png` was retinted. For compressed builds, regenerate `static/palette.ktx` with `npm run compress` (requires [KTX-Software](https://github.com/KhronosGroup/KTX-Software)). Model geometry compression (`VITE_COMPRESSED_MODELS`, on by default) is independent of texture compression (`VITE_COMPRESSED`, off by default) — see `.env.example`.

## Multiplayer server (optional)

The multiplayer client works fully offline (shows "Offline" in the Multiplayer tab). To try it live:

```bash
npm install ws
npm run server
# then in .env: VITE_SERVER_URL=ws://localhost:8080
```

See `server/README.md` for details and limitations — it's a minimal reference relay (no auth, no persistence), not a production backend.

## Setup

Create `.env` file based on `.env.example`

Download and install [Node.js](https://nodejs.org/en/download/) then run this followed commands:

``` bash
# Install dependencies
npm install --force

# Serve at localhost:1234
npm run dev

# Build for production in the dist/ directory
npm run build
```

## Game loop

#### 0

- Time
- Inputs

#### 1

- Player:pre-physics (Inputs)

#### 2

- PhysicalVehicle:pre-physics (Player:pre-physics)

#### 3

- Physics

#### 4

- PhysicsWireframe (Physics)
- Objects (Physics)

#### 5

- PhysicalVehicle:post-physics (Player:pre-physics)

#### 6

- Player:post-physics (Physics, PhysicalVehicle:post-physics)

#### 7

- View (Inputs, Player:post-physics)

#### 8

- Intro
- DayCycles
- YearCycles
- Weather (DayCycles, YearCycles)
- Zones (Player:post-physics)
- VisualVehicle (PhysicalVehicle:post-physics, Inputs, Player:post-physics, View)

#### 9

- Wind (Weather)
- Lighting (DayCycles, View)
- Tornado (DayCycles, PhysicalVehicle)
- InteractivePoints (Player:post-physics)
- Tracks (VisualVehicle)

#### 10

- Area++ (View, PhysicalVehicle:post-physics, Player:post-physics, Wind)
- Foliage (VisualVehicle, View)
- Fog (View)
- Reveal (DayCycles)
- Terrain (Tracks)
- Trails (PhysicalVehicle)
- Floor (View)
- Grass (View, Wind)
- Leaves (View, PhysicalVehicle)
- Lightnings (View, Weather)
- RainLines (View, Weather, Reveal)
- Snow (View, Weather, Reveal, Tracks)
- VisualTornado (Tornado)
- WaterSurface (Weather, View)
- Benches (Objects)
- Bricks (Objects)
- ExplosiveCrates (Objects)
- Fences (Objects)
- Lanterns (Objects)
- Whispers (Player)

#### 13

- InstancedGroup (Objects, [SpecificObjects])

#### 14

- Audio (View, Objects)
- Notifications
- Title (PhysicalVehicle:post-physics)

#### 998

- Rendering

#### 999

- Monitoring

## Blender

### Export

- Mute the palette texture node (loaded and set in Three.js `Material` directly)
- Use corresponding export presets
- Don't use compression (will be done later)

### Compress

Run `npm run compress`

Will do the following

#### GLB

- Traverses the `static/` folder looking for glb files (ignoring already compressed files)
- Compresses embeded texture with `etc1s --quality 255` (lossy, GPU friendly)
- Generates new files to preserve originals

#### Texture files

- Traverses the `static/` folder looking for `png|jpg` files (ignoring non-model related folders)
- Compresses with default preset to `--encode etc1s --qlevel 255` (lossy, GPU friendly) or specific preset according to path
- Generates new files to preserve originals

#### UI files

- Traverses the `static/ui.` folder looking for `png|jpg` files
- Compresses to WebP

#### Resources

- https://gltf-transform.dev/cli
- https://github.com/KhronosGroup/KTX-Software?tab=readme-ov-file
- https://github.khronos.org/KTX-Software/ktxtools/toktx.html