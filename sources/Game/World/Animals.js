import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

// Ambient low-poly deer wandering near the tree groves. Purely decorative:
// they wander their home spot and trot away if the truck gets close.
export class Animals
{
    constructor()
    {
        this.game = Game.getInstance()

        this.fleeRadius = 10
        this.count = 14

        // Home spots near tree groves, away from roads and buildings
        this.spots = [
            { x: 20, z: -62, radius: 12 },
            { x: -52, z: 12, radius: 12 },
            { x: 6, z: 70, radius: 10 },
            { x: -80, z: -40, radius: 14 },
            { x: 12, z: 18, radius: 10 },
            { x: -35, z: 65, radius: 12 },
            { x: 78, z: 30, radius: 10 },
        ]

        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        this.setMaterials()
        this.setGeometries()
        this.setItems()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setMaterials()
    {
        const create = (hex) => new MeshDefaultMaterial({
            colorNode: color(hex),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        this.materials = {}
        this.materials.coats = [ '#8a6a4a', '#6b5038', '#a3805c' ].map(create)
        this.materials.antlers = create('#3d2b20')
    }

    setGeometries()
    {
        this.geometries = {}
        this.geometries.body = new THREE.BoxGeometry(0.3, 0.35, 0.75)
        this.geometries.head = new THREE.BoxGeometry(0.22, 0.22, 0.3)
        this.geometries.leg = new THREE.BoxGeometry(0.09, 0.4, 0.09)
        this.geometries.leg.translate(0, -0.2, 0)
    }

    pick(list)
    {
        return list[Math.floor(Math.random() * list.length)]
    }

    setItems()
    {
        this.items = []

        for(let i = 0; i < this.count; i++)
        {
            const spot = this.spots[i % this.spots.length]
            const coat = this.pick(this.materials.coats)

            const animal = new THREE.Group()

            const body = new THREE.Mesh(this.geometries.body, coat)
            body.position.y = 0.55
            body.castShadow = true
            animal.add(body)

            const head = new THREE.Mesh(this.geometries.head, coat)
            head.position.set(0, 0.68, 0.5)
            animal.add(head)

            const legPositions = [ [-0.1, 0.4, 0.28], [0.1, 0.4, 0.28], [-0.1, 0.4, -0.28], [0.1, 0.4, -0.28] ]
            const legs = legPositions.map(([ x, y, z ]) =>
            {
                const leg = new THREE.Mesh(this.geometries.leg, coat)
                leg.position.set(x, y, z)
                animal.add(leg)
                return leg
            })

            animal.scale.setScalar(0.9 + Math.random() * 0.3)

            const angle = Math.random() * Math.PI * 2
            const radius = Math.random() * spot.radius
            animal.position.set(
                spot.x + Math.cos(angle) * radius,
                0,
                spot.z + Math.sin(angle) * radius
            )

            this.group.add(animal)

            const item = {
                object: animal,
                legs,
                spot,
                target: new THREE.Vector2(animal.position.x, animal.position.z),
                speed: 0,
                walkSpeed: 0.8 + Math.random() * 0.6,
                fleeing: false,
                phase: Math.random() * Math.PI * 2,
                pauseTime: Math.random() * 4,
            }

            this.pickTarget(item)
            this.items.push(item)
        }
    }

    pickTarget(item)
    {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * item.spot.radius
        item.target.set(
            item.spot.x + Math.cos(angle) * radius,
            item.spot.z + Math.sin(angle) * radius
        )
    }

    update()
    {
        const delta = this.game.ticker.deltaScaled
        const playerPosition = this.game.player ? this.game.player.position : null

        for(const item of this.items)
        {
            const object = item.object

            let playerDistance = Infinity
            if(playerPosition)
                playerDistance = Math.hypot(playerPosition.x - object.position.x, playerPosition.z - object.position.z)

            if(playerDistance < this.fleeRadius)
            {
                item.fleeing = true
                item.speed = 5

                const awayX = object.position.x - playerPosition.x
                const awayZ = object.position.z - playerPosition.z
                const length = Math.hypot(awayX, awayZ) || 1
                item.target.set(
                    object.position.x + (awayX / length) * 12,
                    object.position.z + (awayZ / length) * 12
                )
            }
            else if(item.fleeing)
            {
                item.fleeing = false
                this.pickTarget(item)
            }

            const toTargetX = item.target.x - object.position.x
            const toTargetZ = item.target.y - object.position.z
            const targetDistance = Math.hypot(toTargetX, toTargetZ)

            if(!item.fleeing)
            {
                if(targetDistance < 0.5)
                {
                    item.speed = 0
                    item.pauseTime -= delta

                    if(item.pauseTime <= 0)
                    {
                        item.pauseTime = 2 + Math.random() * 5
                        this.pickTarget(item)
                    }
                }
                else
                {
                    item.speed = item.walkSpeed
                }
            }

            if(item.speed > 0 && targetDistance > 0.1)
            {
                const dirX = toTargetX / targetDistance
                const dirZ = toTargetZ / targetDistance

                object.position.x += dirX * item.speed * delta
                object.position.z += dirZ * item.speed * delta

                const targetAngle = Math.atan2(dirX, dirZ)
                let angleDelta = targetAngle - object.rotation.y
                angleDelta = ((angleDelta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
                object.rotation.y += angleDelta * Math.min(1, delta * 6)

                item.phase += delta * item.speed * 4
                const stride = Math.sin(item.phase) * 0.4
                item.legs[0].rotation.x = stride
                item.legs[3].rotation.x = stride
                item.legs[1].rotation.x = - stride
                item.legs[2].rotation.x = - stride
            }
            else
            {
                for(const leg of item.legs)
                    leg.rotation.x = 0
            }
        }
    }
}
