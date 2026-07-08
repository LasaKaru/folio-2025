import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

// 6 hidden collectible eggs scattered in out-of-the-way spots. Drive or
// walk close to pick one up -- each pays a small one-off reward, and
// finding all of them unlocks the "Egg hunter" achievement.
export class Eggs
{
    constructor()
    {
        this.game = Game.getInstance()

        this.reward = 150
        this.pickupRadius = 2.5

        this.spots = [
            { x: -93, z: 8, y: 1 },      // tucked behind the waterfall's pool
            { x: -66, z: 72, y: 1 },     // between the downtown towers
            { x: 22, z: -35, y: 1 },     // just inside the Havoc Compound gate
            { x: -30, z: 42, y: 1 },     // fishing village dock
            { x: 95, z: 12, y: 1 },      // behind the shop strip
            { x: 24, z: 14, y: 1 },      // amongst the shore stones
        ]

        this.load()
        this.setMaterial()
        this.setItems()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 11)
    }

    load()
    {
        try { this.found = new Set(JSON.parse(localStorage.getItem('circuitCity.eggsFound')) ?? []) }
        catch { this.found = new Set() }
    }

    save()
    {
        localStorage.setItem('circuitCity.eggsFound', JSON.stringify([ ...this.found ]))
    }

    setMaterial()
    {
        this.material = this.game.materials.createEmissive('eggShell', '#ffd23f', 2.4)
    }

    setItems()
    {
        this.geometry = new THREE.SphereGeometry(0.5, 12, 10)
        this.items = []

        for(let i = 0; i < this.spots.length; i++)
        {
            if(this.found.has(i))
                continue

            const spot = this.spots[i]
            const mesh = new THREE.Mesh(this.geometry, this.material)
            mesh.scale.set(0.75, 1, 0.75)
            mesh.position.set(spot.x, spot.y, spot.z)
            mesh.castShadow = true
            this.game.scene.add(mesh)

            this.items.push({ index: i, spot, mesh })
        }
    }

    getPlayerPosition()
    {
        if(this.game.character && this.game.character.active)
            return this.game.character.position

        return this.game.player.position
    }

    update()
    {
        if(this.items.length === 0)
            return

        const elapsed = this.game.ticker.elapsed
        const playerPosition = this.getPlayerPosition()

        for(let i = this.items.length - 1; i >= 0; i--)
        {
            const item = this.items[i]
            item.mesh.rotation.y = elapsed * 2
            item.mesh.position.y = item.spot.y + Math.sin(elapsed * 3 + item.index) * 0.2

            const distance = Math.hypot(playerPosition.x - item.spot.x, playerPosition.z - item.spot.z, playerPosition.y - item.spot.y)

            if(distance < this.pickupRadius)
            {
                this.collect(item)
                this.items.splice(i, 1)
            }
        }
    }

    collect(item)
    {
        this.found.add(item.index)
        this.save()

        this.game.scene.remove(item.mesh)

        this.game.missions.addCash(this.reward)
        this.game.achievements.setProgress('eggHunter', this.found.size)

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🥚 Egg found!</div>
                </div>
                <div class="bottom">
                    <div class="description">${this.found.size}/${this.spots.length} -- +${this.reward} CR</div>
                </div>
            `,
            'egg',
            4,
            null,
            `egg-${item.index}`
        )
    }
}
