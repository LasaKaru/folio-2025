// Garage upgrade definitions.
// Level costs grow geometrically: cost(level) = round(baseCost * growth^level)

const cost = (baseCost, growth, level) => Math.round(baseCost * Math.pow(growth, level))

export const truckUpgrades = {
    engine:   { name: 'Engine', description: 'More acceleration force', max: 5, baseCost: 200, growth: 1.55, step: 0.15 },
    boost:    { name: 'Boost', description: 'Stronger nitro boost', max: 5, baseCost: 220, growth: 1.55, step: 0.2 },
    handling: { name: 'Handling', description: 'Sharper steering', max: 5, baseCost: 180, growth: 1.5, step: 0.1 },
}

export const weaponUpgrades = {
    damage: { name: 'Damage', description: 'All weapons hit harder', max: 5, baseCost: 180, growth: 1.55, step: 0.2 },
    rate:   { name: 'Fire rate', description: 'All weapons reload faster', max: 5, baseCost: 190, growth: 1.55, step: 0.03 },
}

export const heroUpgrades = {
    health: { name: 'Max health', description: '+20 HP per level', max: 5, baseCost: 150, growth: 1.5, step: 20 },
    sprint: { name: 'Sprint speed', description: 'Run faster', max: 5, baseCost: 150, growth: 1.5, step: 0.55 },
}

export const weaponUnlocks = {
    shotgun:    { name: 'Shotgun', description: 'Five-pellet spread, brutal up close', cost: 700 },
    rocket:     { name: 'Rocket Launcher', description: 'Splash damage, one shot clears a crowd', cost: 1300 },
    melee:      { name: 'Havoc Bat', description: 'Free swings, no ammo, gets the job done', cost: 400 },
    tripleShot: { name: 'Triple Shot Mod', description: 'Blaster fires a 3-bolt spread', cost: 950 },
}

export const truckPaints = {
    neonCyan:    { name: 'Neon Cyan', cost: 300, colorA: '#00e5ff', colorB: '#0b3d91' },
    neonMagenta: { name: 'Neon Magenta', cost: 300, colorA: '#ff2ea0', colorB: '#560046' },
    toxicGreen:  { name: 'Toxic Green', cost: 450, colorA: '#54ff9f', colorB: '#0a5c34' },
    gold:        { name: 'Havoc Gold', cost: 900, colorA: '#ffd23f', colorB: '#8a5a00' },
    chrome:      { name: 'Chrome', cost: 1200, colorA: '#f2f2f2', colorB: '#555566' },
}

export const heroOutfits = {
    default:  { name: 'Havoc Jacket', cost: 0, jacket: '#00e5ff', visor: '#ff2ea0' },
    crimson:  { name: 'Crimson Runner', cost: 350, jacket: '#ff2e4a', visor: '#ffd23f' },
    toxic:    { name: 'Toxic Courier', cost: 350, jacket: '#54ff9f', visor: '#0b1c66' },
    royal:    { name: 'Royal Havoc', cost: 600, jacket: '#b56bff', visor: '#00e5ff' },
    blackout: { name: 'Blackout', cost: 800, jacket: '#1a1a22', visor: '#ff2ea0' },
}

export const weaponSkins = {
    default: { name: 'Standard Bolt', cost: 0, color: '#7dffea' },
    ember:   { name: 'Ember Rounds', cost: 300, color: '#ff6a2a' },
    venom:   { name: 'Venom Rounds', cost: 300, color: '#8bff3a' },
    royal:   { name: 'Royal Rounds', cost: 500, color: '#c58bff' },
}

export const getUpgradeCost = (definition, level) => cost(definition.baseCost, definition.growth, level)
