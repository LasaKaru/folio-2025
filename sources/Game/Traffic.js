import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

// Simple background traffic: box "cars" looping along fixed routes across
// the island, the same low-cost approach Multiplayer.js uses for other
// players' ghost cars. No Rapier colliders -- like Citizens.js pedestrians,
// these are visual-only and use a distance check against the player instead
// of real physics, yielding (slowing down) when the player's truck gets
// close and fast rather than actually colliding.
export class Traffic
{
    constructor()
    {
        this.game = Game.getInstance()

        this.enabled = localStorage.getItem('circuitCity.traffic') !== 'off'
        this.yieldRadius = 9
        this.speed = 5
        this.carsPerRoute = 2

        // Loop routes, reusing coordinates already validated as drivable by
        // the checkpoint missions in sources/data/missions.js.
        this.routes = [
            [ { x: 30, z: 15 }, { x: 26.3, z: 9.6 }, { x: 25.7, z: -14.5 }, { x: 48.8, z: -11.5 }, { x: 70, z: 20.4 } ],
            [ { x: 55.1, z: 44 }, { x: 39.5, z: 37.8 }, { x: 49.2, z: 34.6 }, { x: 52.2, z: 26.2 } ],
            [ { x: 66, z: 24 }, { x: 21.3, z: 62.2 }, { x: 70.9, z: 66 }, { x: 55.1, z: 44 }, { x: 70, z: 20.4 }, { x: 74.8, z: -14.1 }, { x: 36.9, z: -27.9 }, { x: 27.9, z: -42.1 } ],
        ]

        this.colors = [ '#ffd23f', '#54ff9f', '#b56bff', '#ff6b4a', '#00e5ff', '#ff2ea0' ]

        this.group = new THREE.Group()
        this.group.visible = this.enabled
        this.game.scene.add(this.group)

        this.geometry = new THREE.BoxGeometry(1.7, 0.9, 3.4)
        this.setItems()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setEnabled(enabled)
    {
        this.enabled = enabled
        this.group.visible = enabled
        localStorage.setItem('circuitCity.traffic', enabled ? 'on' : 'off')
    }

    setItems()
    {
        this.items = []
        let colorIndex = 0

        for(const route of this.routes)
        {
            for(let i = 0; i < this.carsPerRoute; i++)
            {
                const material = new THREE.MeshBasicNodeMaterial({ color: this.colors[colorIndex % this.colors.length] })
                colorIndex++

                const mesh = new THREE.Mesh(this.geometry, material)
                mesh.position.y = 0.45
                this.group.add(mesh)

                const waypointIndex = Math.floor((route.length / this.carsPerRoute) * i) % route.length
                const start = route[waypointIndex]
                mesh.position.x = start.x
                mesh.position.z = start.z

                this.items.push({ mesh, route, waypointIndex })
            }
        }
    }

    update()
    {
        if(!this.enabled)
            return

        const delta = this.game.ticker.deltaScaled
        const playerPosition = this.game.player?.position
        const playerSpeed = this.game.physicalVehicle?.xzSpeed ?? 0

        for(const item of this.items)
        {
            const target = item.route[item.waypointIndex]
            const dx = target.x - item.mesh.position.x
            const dz = target.z - item.mesh.position.z
            const distance = Math.hypot(dx, dz)

            if(distance < 1.5)
            {
                item.waypointIndex = (item.waypointIndex + 1) % item.route.length
                continue
            }

            let speed = this.speed

            // Yield to a fast-approaching player instead of pretending to
            // have real collision avoidance.
            if(playerPosition)
            {
                const playerDistance = Math.hypot(playerPosition.x - item.mesh.position.x, playerPosition.z - item.mesh.position.z)
                if(playerDistance < this.yieldRadius && playerSpeed > 6)
                    speed *= 0.25
            }

            const dirX = dx / distance
            const dirZ = dz / distance

            item.mesh.position.x += dirX * speed * delta
            item.mesh.position.z += dirZ * speed * delta

            const targetAngle = Math.atan2(dirX, dirZ)
            let angleDelta = targetAngle - item.mesh.rotation.y
            angleDelta = ((angleDelta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
            item.mesh.rotation.y += angleDelta * Math.min(1, delta * 4)
        }
    }
}
