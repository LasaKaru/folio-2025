# Neon Havoc

An open-world neon driving game: missions, citizens, credits and one very bouncy truck.

Built as a heavily remixed edition of [Bruno Simon's folio-2025](https://github.com/brunosimon/folio-2025) (MIT license) — recolored to a neon night-city vibe and expanded into a full game.

## What's new vs the original

- **Full recolor** — retinted model palette (`scripts/retheme-palette.js`), neon day cycles, terrain, trees, grid and UI
- **Missions** — 10 missions across the island (checkpoint sprints, orb collections, timed deliveries) with rewards in credits, a mission HUD and dedicated achievements. Drive into a blue beacon to start one
- **Citizens** — low-poly pedestrians strolling around town; they flee the truck and dive out of the way
- **The Havoc Compound** — a walled home base south of downtown with watchtowers, a helipad, a stunt ramp and its own respawn point
- **New options** — citizens on/off, Neon/Classic color theme, mission HUD toggle
- **Rebranded** — new name, texts, console art and metadata

> Note: `static/palette.png` was retinted. For compressed builds, regenerate `static/palette.ktx` with `npm run compress` (requires [KTX-Software](https://github.com/KhronosGroup/KTX-Software)).

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