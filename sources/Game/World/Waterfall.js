import * as THREE from 'three/webgpu'
import { color, mod, sin, uv } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

// A single decorative waterfall: a rocky outcrop with a scrolling cascade
// texture, dropping into a small pool. Placed away from any road/mission.
export class Waterfall
{
    constructor()
    {
        this.game = Game.getInstance()
        this.position = { x: -95, z: 10 }

        this.group = new THREE.Group()
        this.group.position.set(this.position.x, 0, this.position.z)

        this.setCliff()
        this.setCascade()
        this.setPool()

        this.game.scene.add(this.group)

        this.game.objects.add(null, {
            type: 'fixed',
            friction: 0.4,
            restitution: 0,
            colliders: [
                { shape: 'cuboid', parameters: [ 4, 6, 2 ], position: { x: this.position.x, y: 6, z: this.position.z - 4 }, category: 'floor' },
            ]
        })
    }

    setCliff()
    {
        const material = new MeshDefaultMaterial({
            colorNode: color('#4a4360'),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        const cliff = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 4), material)
        cliff.position.set(0, 6, -4)
        cliff.castShadow = true
        cliff.receiveShadow = true
        this.group.add(cliff)
    }

    setCascade()
    {
        // Vertically scrolling UVs give a cheap falling-water look without a
        // per-frame JS tick: the offset is driven by the ticker's uniform.
        const scroll = mod(this.game.ticker.elapsedScaledUniform.mul(0.6), 1)
        const stripes = sin(uv().x.mul(40)).mul(0.15).add(0.85)
        const flow = sin(uv().y.sub(scroll).mul(60)).mul(0.1).add(0.9)

        const material = new MeshDefaultMaterial({
            colorNode: color('#8fe9ff').mul(stripes).mul(flow),
            hasCoreShadows: false,
            hasDropShadows: false,
        })
        material.transparent = true
        material.opacity = 0.85

        const cascade = new THREE.Mesh(new THREE.PlaneGeometry(3, 10), material)
        cascade.position.set(0, 5, -1.95)
        this.group.add(cascade)
    }

    setPool()
    {
        const shimmer = sin(this.game.ticker.elapsedScaledUniform.mul(1.6)).mul(0.08).add(0.92)
        const material = new MeshDefaultMaterial({
            colorNode: color('#1fb7ff').mul(shimmer),
            hasCoreShadows: false,
            hasDropShadows: false,
        })

        const geometry = new THREE.CircleGeometry(1, 32)
        geometry.rotateX(- Math.PI * 0.5)

        const pool = new THREE.Mesh(geometry, material)
        pool.position.set(0, 0.05, 2)
        pool.scale.setScalar(5)
        pool.receiveShadow = true
        this.group.add(pool)
    }
}
