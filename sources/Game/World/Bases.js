import { Game } from '../Game.js'
import { Base } from './Base.js'

// Three player home bases scattered around the island, each its own
// walled compound with a respawn point.
export class Bases
{
    constructor()
    {
        this.game = Game.getInstance()

        const configs = [
            { name: 'Havoc Compound', respawnName: 'base', center: { x: 27.9, z: -42.1 }, size: 40 },
            { name: 'Northside Garage', respawnName: 'baseNorth', center: { x: -60, z: 85 }, size: 32 },
            { name: 'Old Port Yard', respawnName: 'basePort', center: { x: 90, z: 65 }, size: 30 },
        ]

        this.list = configs.map((config) => new Base(config))
    }
}
