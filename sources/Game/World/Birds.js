import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

// Ambient flying birds: cheap non-physics flocks circling a handful of
// spots around the island, purely decorative.
export class Birds
{
    constructor()
    {
        this.game = Game.getInstance()

        this.flocks = [
            { x: 39.5, z: 37.8, radius: 22, height: 14, count: 6 },
            { x: -30, z: 42, radius: 18, height: 12, count: 5 },
            { x: -72, z: 58, radius: 26, height: 22, count: 6 },
            { x: 20, z: -62, radius: 16, height: 10, count: 5 },
        ]

        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        this.setMaterial()
        this.setItems()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setMaterial()
    {
        this.material = new MeshDefaultMaterial({
            colorNode: color('#241b38'),
            hasCoreShadows: false,
            hasDropShadows: false,
        })
    }

    setItems()
    {
        this.bodyGeometry = new THREE.ConeGeometry(0.08, 0.4, 4)
        this.bodyGeometry.rotateX(Math.PI * 0.5)

        this.wingGeometry = new THREE.PlaneGeometry(0.5, 0.16)

        this.items = []

        for(const flock of this.flocks)
        {
            for(let i = 0; i < flock.count; i++)
            {
                const bird = new THREE.Group()

                const body = new THREE.Mesh(this.bodyGeometry, this.material)
                bird.add(body)

                const wingLeft = new THREE.Mesh(this.wingGeometry, this.material)
                wingLeft.position.set(-0.22, 0, 0)
                bird.add(wingLeft)

                const wingRight = new THREE.Mesh(this.wingGeometry, this.material)
                wingRight.position.set(0.22, 0, 0)
                bird.add(wingRight)

                this.group.add(bird)

                this.items.push({
                    object: bird,
                    wingLeft,
                    wingRight,
                    flock,
                    angle: Math.random() * Math.PI * 2,
                    angleSpeed: 0.25 + Math.random() * 0.2,
                    heightOffset: Math.random() * 3,
                    phase: Math.random() * Math.PI * 2,
                    radiusRatio: 0.6 + Math.random() * 0.4,
                })
            }
        }
    }

    update()
    {
        const delta = this.game.ticker.deltaScaled
        const elapsed = this.game.ticker.elapsed

        for(const item of this.items)
        {
            item.angle += item.angleSpeed * delta

            const radius = item.flock.radius * item.radiusRatio
            const x = item.flock.x + Math.cos(item.angle) * radius
            const z = item.flock.z + Math.sin(item.angle) * radius
            const y = item.flock.height + item.heightOffset + Math.sin(elapsed * 0.5 + item.phase) * 1.2

            item.object.position.set(x, y, z)
            item.object.rotation.y = - item.angle - Math.PI * 0.5

            const flap = Math.sin(elapsed * 10 + item.phase) * 0.6
            item.wingLeft.rotation.z = flap
            item.wingRight.rotation.z = - flap
        }
    }
}
