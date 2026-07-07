// The Neon Havoc story campaign.
// Each chapter spawns a raider camp; clear it to unlock the next one.

export default [
    {
        id: 'chapter1',
        title: 'First Blood',
        text: 'Raiders set up a scout post right outside your compound. Step out of the truck (G), grab your blaster (X) and send them packing.',
        camp: { center: { x: 48, z: -48 }, count: 4, radius: 6 },
        reward: 400,
    },
    {
        id: 'chapter2',
        title: 'Village Defense',
        text: 'The old fishing village north-west is overrun. The citizens there paid for protection — time to deliver.',
        camp: { center: { x: -30, z: 42 }, count: 5, radius: 8 },
        reward: 500,
    },
    {
        id: 'chapter3',
        title: 'Shore Patrol',
        text: 'Smugglers land crates of contraband on the east shore. Their guards won’t leave politely.',
        camp: { center: { x: 82, z: 34 }, count: 6, radius: 9 },
        reward: 650,
    },
    {
        id: 'chapter4',
        title: 'Circuit Siege',
        text: 'They took the racing circuit and turned it into a toll gate. Nobody taxes the circuit. Nobody.',
        camp: { center: { x: -22, z: 4 }, count: 7, radius: 10 },
        reward: 800,
    },
    {
        id: 'chapter5',
        title: 'The Havoc King',
        text: 'Their warlord hides by the time machine in the far west, guarded by his best. End this story — or become part of his.',
        camp: { center: { x: -52, z: -58 }, count: 5, radius: 7, boss: true },
        reward: 1500,
    },
]
