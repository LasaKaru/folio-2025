// Circuit City missions
// Coordinates are world positions (x, z), y is optional (defaults to ground level)
// Types:
// - "checkpoints": drive through every gate in order
// - "collect": grab every orb, any order
// - "delivery": reach the beacon before the clock runs out

const ring = (cx, cz, radius, count, startAngle = 0) =>
{
    const points = []
    for(let i = 0; i < count; i++)
    {
        const angle = startAngle + (i / count) * Math.PI * 2
        points.push({
            x: Math.round((cx + Math.cos(angle) * radius) * 10) / 10,
            z: Math.round((cz + Math.sin(angle) * radius) * 10) / 10,
        })
    }
    return points
}

const line = (ax, az, bx, bz, count) =>
{
    const points = []
    for(let i = 0; i < count; i++)
    {
        const t = i / (count - 1)
        points.push({
            x: Math.round((ax + (bx - ax) * t) * 10) / 10,
            z: Math.round((az + (bz - az) * t) * 10) / 10,
        })
    }
    return points
}

export default [
    {
        id: 'neonRun',
        name: 'Neon Run',
        tagline: 'Warm up those tires around the plaza',
        type: 'checkpoints',
        start: { x: 45, z: 37 },
        timeLimit: 50,
        reward: 250,
        points: [
            { x: 49.2, z: 34.6 },
            { x: 52.2, z: 26.2 },
            { x: 55.1, z: 44 },
            { x: 39.5, z: 37.8 },
        ]
    },
    {
        id: 'plazaCollector',
        name: 'Plaza Collector',
        tagline: 'Neon orbs rain over downtown, grab them all',
        type: 'collect',
        start: { x: 30, z: 24 },
        timeLimit: 60,
        reward: 300,
        points: ring(30, 15, 13, 8)
    },
    {
        id: 'latrineExpress',
        name: 'Latrine Express',
        tagline: 'A mystery package must reach the latrine, no questions',
        type: 'delivery',
        start: { x: 57, z: 47 },
        timeLimit: 45,
        reward: 350,
        points: [ { x: 70.9, z: 66 } ]
    },
    {
        id: 'downtownSprint',
        name: 'Downtown Sprint',
        tagline: 'Five gates, one shot, all downtown',
        type: 'checkpoints',
        start: { x: 30, z: 5 },
        timeLimit: 70,
        reward: 500,
        points: [
            { x: 26.3, z: 9.6 },
            { x: 25.7, z: -14.5 },
            { x: 48.8, z: -11.5 },
            { x: 70, z: 20.4 },
            { x: 74.8, z: -14.1 },
        ]
    },
    {
        id: 'compoundGauntlet',
        name: 'Compound Gauntlet',
        tagline: 'Lap the Havoc Compound perimeter',
        type: 'checkpoints',
        start: { x: 27.9, z: -28 },
        timeLimit: 45,
        reward: 450,
        points: ring(27.9, -42.1, 16, 6, Math.PI * 0.5)
    },
    {
        id: 'westExpress',
        name: 'West Express',
        tagline: 'Rush a package to the time machine, far west',
        type: 'delivery',
        start: { x: -13.7, z: 14.7 },
        timeLimit: 50,
        reward: 550,
        points: [ { x: -56.5, z: -64.7 } ]
    },
    {
        id: 'boulevardOrbs',
        name: 'Boulevard Orbs',
        tagline: 'A trail of orbs runs across the island',
        type: 'collect',
        start: { x: 18, z: 58 },
        timeLimit: 65,
        reward: 500,
        points: line(20, 55, 65, 25, 10)
    },
    {
        id: 'bowlingDash',
        name: 'Bowling Dash',
        tagline: 'League night starts without you, floor it',
        type: 'delivery',
        start: { x: 25.7, z: -18 },
        timeLimit: 40,
        reward: 400,
        points: [ { x: 21.3, z: 62.2 } ]
    },
    {
        id: 'islandTour',
        name: 'Island Tour',
        tagline: 'The grand tour, every corner of the island',
        type: 'checkpoints',
        start: { x: 66, z: 24 },
        timeLimit: 150,
        reward: 1200,
        points: [
            { x: 21.3, z: 62.2 },
            { x: 70.9, z: 66 },
            { x: 55.1, z: 44 },
            { x: 70, z: 20.4 },
            { x: 74.8, z: -14.1 },
            { x: 36.9, z: -27.9 },
            { x: 27.9, z: -42.1 },
            { x: -13.7, z: 14.7, y: 2.2 },
            { x: 39.5, z: 37.8 },
        ]
    },
    {
        id: 'plazaFare',
        name: 'Plaza Fare',
        tagline: 'A fare needs a ride across town',
        type: 'taxi',
        stageTexts: [ 'Pick up the fare at the plaza', 'Get them to the bowling alley' ],
        start: { x: 35, z: 20 },
        timeLimit: 55,
        reward: 300,
        points: [
            { x: 30, z: 15 },
            { x: 21.3, z: 62.2 },
        ]
    },
    {
        id: 'harborFare',
        name: 'Harbor Fare',
        tagline: 'One more fare, this one wants the toilet block',
        type: 'taxi',
        stageTexts: [ 'Pick up the fare downtown', 'Drop them at the latrine' ],
        start: { x: 60, z: 25 },
        timeLimit: 60,
        reward: 350,
        points: [
            { x: 48.8, z: -11.5 },
            { x: 70.9, z: 66 },
        ]
    },
    {
        id: 'compoundLaunch',
        name: 'Compound Launch',
        tagline: 'Send it off the stunt ramp and stick the landing',
        type: 'stunt',
        start: { x: 27.9, z: -50 },
        timeLimit: 30,
        reward: 350,
        points: [ { x: 27.9, z: -20, y: 3.5 } ]
    },
    {
        id: 'downtownRampage',
        name: 'Downtown Rampage',
        tagline: 'Every raider you drop for the next 30s pays double',
        type: 'rampage',
        start: { x: 30, z: 10 },
        timeLimit: 30,
        reward: 200,
        killBonus: 20,
        points: []
    },
    {
        id: 'harborSweep',
        name: 'Harbor Sweep',
        tagline: 'Twelve orbs circle the whole island, sweep them up',
        type: 'collect',
        start: { x: 52, z: 30 },
        timeLimit: 110,
        reward: 900,
        points: ring(30, 10, 48, 12)
    },
]
