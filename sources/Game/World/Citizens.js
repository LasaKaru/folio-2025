import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

// Low-poly human citizens wandering the streets.
// They stroll around their home spot, panic when the car gets close,
// and dive out of the way when it gets too close.
export class Citizens
{
    static STATE_STROLL = 1
    static STATE_FLEE = 2
    static STATE_DOWN = 3

    constructor()
    {
        this.game = Game.getInstance()

        this.enabled = localStorage.getItem('neonHavoc.citizens') !== 'off'
        this.count = 14
        this.fleeRadius = 8
        this.knockRadius = 1.9
        this.bumped = 0

        // Home spots on flat ground (x, z, radius)
        this.spots = [
            { x: 30, z: 15, radius: 12 },   // downtown plaza
            { x: 39.5, z: 37.8, radius: 9 }, // landing
            { x: 25.7, z: -14.5, radius: 8 }, // social
            { x: 21.3, z: 62.2, radius: 8 }, // bowling
            { x: 55.1, z: 44, radius: 7 },  // bonfire
            { x: 27.9, z: -34, radius: 7 }, // compound gate
        ]

        this.group = new THREE.Group()
        this.group.visible = this.enabled
        this.game.scene.add(this.group)

        this.setMaterials()
        this.setGeometries()
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
        localStorage.setItem('neonHavoc.citizens', enabled ? 'on' : 'off')
    }

    setMaterials()
    {
        const create = (hex) => new MeshDefaultMaterial({
            colorNode: color(hex),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        this.materials = {}
        this.materials.skins = [ '#ffc8a8', '#b57950', '#6b4630' ].map(create)
        this.materials.shirts = [ '#ff2ea0', '#00e5ff', '#ffd23f', '#54ff9f', '#b56bff', '#ff6b4a' ].map(create)
        this.materials.pants = [ '#2b2436', '#3d3d55', '#6b4a7a' ].map(create)
    }

    setGeometries()
    {
        this.geometries = {}

        this.geometries.leg = new THREE.BoxGeometry(0.13, 0.4, 0.13)
        this.geometries.leg.translate(0, -0.2, 0)

        this.geometries.torso = new THREE.BoxGeometry(0.36, 0.45, 0.22)

        this.geometries.head = new THREE.BoxGeometry(0.24, 0.24, 0.24)

        this.geometries.arm = new THREE.BoxGeometry(0.1, 0.38, 0.1)
        this.geometries.arm.translate(0, -0.19, 0)
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

            const skin = this.pick(this.materials.skins)
            const shirt = this.pick(this.materials.shirts)
            const pants = this.pick(this.materials.pants)

            const citizen = new THREE.Group()

            const legLeft = new THREE.Mesh(this.geometries.leg, pants)
            legLeft.position.set(-0.09, 0.4, 0)
            citizen.add(legLeft)

            const legRight = new THREE.Mesh(this.geometries.leg, pants)
            legRight.position.set(0.09, 0.4, 0)
            citizen.add(legRight)

            const torso = new THREE.Mesh(this.geometries.torso, shirt)
            torso.position.y = 0.625
            torso.castShadow = true
            citizen.add(torso)

            const head = new THREE.Mesh(this.geometries.head, skin)
            head.position.y = 0.97
            citizen.add(head)

            const armLeft = new THREE.Mesh(this.geometries.arm, shirt)
            armLeft.position.set(-0.23, 0.82, 0)
            citizen.add(armLeft)

            const armRight = new THREE.Mesh(this.geometries.arm, skin)
            armRight.position.set(0.23, 0.82, 0)
            citizen.add(armRight)

            citizen.scale.setScalar(1.5)

            const angle = Math.random() * Math.PI * 2
            const radius = Math.random() * spot.radius
            citizen.position.set(
                spot.x + Math.cos(angle) * radius,
                0,
                spot.z + Math.sin(angle) * radius
            )

            this.group.add(citizen)

            const item = {
                object: citizen,
                legLeft, legRight, armLeft, armRight,
                spot,
                state: Citizens.STATE_STROLL,
                target: new THREE.Vector2(citizen.position.x, citizen.position.z),
                speed: 0,
                walkSpeed: 1 + Math.random() * 0.8,
                phase: Math.random() * Math.PI * 2,
                downTime: 0,
                pauseTime: Math.random() * 3,
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
        if(!this.enabled)
            return

        const delta = this.game.ticker.deltaScaled
        const playerPosition = this.game.player ? this.game.player.position : null
        const playerSpeed = this.game.physicalVehicle ? this.game.physicalVehicle.xzSpeed : 0

        for(const item of this.items)
        {
            const object = item.object

            // Distance to the car
            let playerDistance = Infinity
            if(playerPosition)
                playerDistance = Math.hypot(playerPosition.x - object.position.x, playerPosition.z - object.position.z)

            // Knocked down
            if(item.state === Citizens.STATE_DOWN)
            {
                item.downTime -= delta

                // Lie down flat (fast fall, slow recover at the end)
                const lieRatio = Math.min(1, Math.max(0, item.downTime < 0.6 ? item.downTime / 0.6 : 1))
                object.rotation.x = - Math.PI * 0.5 * lieRatio

                if(item.downTime <= 0)
                {
                    object.rotation.x = 0
                    item.state = Citizens.STATE_STROLL
                    this.pickTarget(item)
                }
                continue
            }

            // Get knocked
            if(playerDistance < this.knockRadius && playerSpeed > 4)
            {
                item.state = Citizens.STATE_DOWN
                item.downTime = 3

                // Dive away from the car
                const awayX = object.position.x - playerPosition.x
                const awayZ = object.position.z - playerPosition.z
                const length = Math.hypot(awayX, awayZ) || 1
                object.position.x += (awayX / length) * 1.2
                object.position.z += (awayZ / length) * 1.2
                object.rotation.y = Math.atan2(-awayX, -awayZ)

                this.bumped++
                this.game.achievements.addProgress('bump')
                continue
            }

            // Flee or stroll
            if(playerDistance < this.fleeRadius && playerSpeed > 3)
            {
                item.state = Citizens.STATE_FLEE
                item.speed = 4.2

                // Run away from the car
                const awayX = object.position.x - playerPosition.x
                const awayZ = object.position.z - playerPosition.z
                const length = Math.hypot(awayX, awayZ) || 1
                item.target.set(
                    object.position.x + (awayX / length) * 10,
                    object.position.z + (awayZ / length) * 10
                )
            }
            else if(item.state === Citizens.STATE_FLEE)
            {
                item.state = Citizens.STATE_STROLL
                this.pickTarget(item)
            }

            // Move toward target
            const toTargetX = item.target.x - object.position.x
            const toTargetZ = item.target.y - object.position.z
            const targetDistance = Math.hypot(toTargetX, toTargetZ)

            if(item.state === Citizens.STATE_STROLL)
            {
                if(targetDistance < 0.5)
                {
                    item.speed = 0
                    item.pauseTime -= delta

                    if(item.pauseTime <= 0)
                    {
                        item.pauseTime = 1 + Math.random() * 4
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

                // Face walking direction (smoothed)
                const targetAngle = Math.atan2(dirX, dirZ)
                let angleDelta = targetAngle - object.rotation.y
                angleDelta = ((angleDelta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
                object.rotation.y += angleDelta * Math.min(1, delta * 8)

                // Walk cycle
                item.phase += delta * item.speed * 5
                const swing = Math.sin(item.phase) * 0.55
                item.legLeft.rotation.x = swing
                item.legRight.rotation.x = - swing

                if(item.state === Citizens.STATE_FLEE)
                {
                    // Arms up, panic
                    item.armLeft.rotation.x = Math.PI
                    item.armRight.rotation.x = Math.PI
                }
                else
                {
                    item.armLeft.rotation.x = - swing * 0.7
                    item.armRight.rotation.x = swing * 0.7
                }

                object.position.y = Math.abs(Math.sin(item.phase)) * 0.05
            }
            else
            {
                item.legLeft.rotation.x = 0
                item.legRight.rotation.x = 0
                item.armLeft.rotation.x = 0
                item.armRight.rotation.x = 0
                object.position.y = 0
            }
        }
    }
}
