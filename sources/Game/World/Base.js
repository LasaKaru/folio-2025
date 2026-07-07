import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

// The Havoc Compound: the player's home base, south of downtown.
// A walled yard with corner watchtowers, a helipad, a stunt ramp
// and neon trim, built from simple physical blocks.
export class Base
{
    constructor()
    {
        this.game = Game.getInstance()

        this.center = { x: 27.9, z: -42.1 }
        this.size = 40
        this.wallHeight = 2.4
        this.wallThickness = 0.6
        this.gateWidth = 8

        this.setMaterials()
        this.setVisual()
        this.setPhysics()
        this.setRespawn()
    }

    setMaterials()
    {
        this.materials = {}
        this.materials.concrete = new MeshDefaultMaterial({
            colorNode: color('#463d63'),
            hasCoreShadows: true,
            hasDropShadows: true,
        })
        this.materials.dark = new MeshDefaultMaterial({
            colorNode: color('#2b2440'),
            hasCoreShadows: true,
            hasDropShadows: true,
        })
        this.materials.pad = new MeshDefaultMaterial({
            colorNode: color('#232038'),
            hasCoreShadows: true,
            hasDropShadows: true,
        })
        this.materials.neonCyan = this.game.materials.createEmissive('baseNeonCyan', '#00e5ff', 2)
        this.materials.neonMagenta = this.game.materials.createEmissive('baseNeonMagenta', '#ff2ea0', 2)
    }

    box(width, height, depth, x, y, z, material, group)
    {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            material
        )
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
        return mesh
    }

    setVisual()
    {
        const { x: cx, z: cz } = this.center
        const half = this.size * 0.5
        const group = new THREE.Group()

        // Slab
        this.box(this.size, 0.3, this.size, cx, 0.15, cz, this.materials.dark, group)

        // Walls (north and south have a gate gap)
        const segmentLength = (this.size - this.gateWidth) * 0.5
        const segmentOffset = this.gateWidth * 0.5 + segmentLength * 0.5
        const wallY = this.wallHeight * 0.5 + 0.3

        for(const side of [ -1, 1 ])
        {
            // North / south segments
            this.box(segmentLength, this.wallHeight, this.wallThickness, cx - segmentOffset, wallY, cz + half * side, this.materials.concrete, group)
            this.box(segmentLength, this.wallHeight, this.wallThickness, cx + segmentOffset, wallY, cz + half * side, this.materials.concrete, group)

            // East / west full walls
            this.box(this.wallThickness, this.wallHeight, this.size, cx + half * side, wallY, cz, this.materials.concrete, group)

            // Neon trim above the gates
            this.box(this.gateWidth, 0.25, 0.25, cx, this.wallHeight + 0.8, cz + half * side, this.materials.neonMagenta, group)

            // Gate pylons
            for(const pylonSide of [ -1, 1 ])
            {
                this.box(0.5, 3.4, 0.5, cx + (this.gateWidth * 0.5 + 0.4) * pylonSide, 2, cz + half * side, this.materials.dark, group)
                this.box(0.6, 0.4, 0.6, cx + (this.gateWidth * 0.5 + 0.4) * pylonSide, 3.9, cz + half * side, this.materials.neonCyan, group)
            }
        }

        // Corner watchtowers with neon caps
        for(const sx of [ -1, 1 ])
        {
            for(const sz of [ -1, 1 ])
            {
                const towerX = cx + (half - 1.2) * sx
                const towerZ = cz + (half - 1.2) * sz
                this.box(2.4, 7, 2.4, towerX, 3.8, towerZ, this.materials.concrete, group)
                this.box(2.8, 0.4, 2.8, towerX, 7.5, towerZ, sx * sz > 0 ? this.materials.neonCyan : this.materials.neonMagenta, group)
            }
        }

        // Helipad
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.16, 24), this.materials.pad)
        pad.position.set(cx, 0.38, cz)
        pad.receiveShadow = true
        group.add(pad)

        const padRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.12, 8, 40), this.materials.neonCyan)
        padRing.rotation.x = - Math.PI * 0.5
        padRing.position.set(cx, 0.5, cz)
        group.add(padRing)

        // Stunt ramp aimed at the north gate
        this.rampAngle = 0.24
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 12), this.materials.concrete)
        ramp.position.set(cx, 1.4, cz + 8)
        ramp.rotation.x = this.rampAngle
        ramp.castShadow = true
        ramp.receiveShadow = true
        group.add(ramp)

        // Crate stacks in the yard
        this.box(2, 2, 2, cx - 12, 1.3, cz - 10, this.materials.dark, group)
        this.box(1.4, 1.4, 1.4, cx - 12, 3, cz - 10, this.materials.concrete, group)
        this.box(2, 2, 2, cx + 12, 1.3, cz - 8, this.materials.dark, group)

        this.game.scene.add(group)
        this.group = group
    }

    setPhysics()
    {
        const { x: cx, z: cz } = this.center
        const half = this.size * 0.5
        const segmentLength = (this.size - this.gateWidth) * 0.5
        const segmentOffset = this.gateWidth * 0.5 + segmentLength * 0.5
        const wallY = this.wallHeight * 0.5 + 0.3

        const colliders = []

        const cuboid = (hx, hy, hz, x, y, z, quaternion = null) =>
        {
            const collider = { shape: 'cuboid', parameters: [ hx, hy, hz ], position: { x, y, z }, category: 'floor' }
            if(quaternion)
                collider.quaternion = quaternion
            colliders.push(collider)
        }

        // Slab
        cuboid(half, 0.15, half, cx, 0.15, cz)

        // Walls
        for(const side of [ -1, 1 ])
        {
            cuboid(segmentLength * 0.5, this.wallHeight * 0.5, this.wallThickness * 0.5, cx - segmentOffset, wallY, cz + half * side)
            cuboid(segmentLength * 0.5, this.wallHeight * 0.5, this.wallThickness * 0.5, cx + segmentOffset, wallY, cz + half * side)
            cuboid(this.wallThickness * 0.5, this.wallHeight * 0.5, half, cx + half * side, wallY, cz)

            // Gate pylons
            for(const pylonSide of [ -1, 1 ])
                cuboid(0.25, 1.7, 0.25, cx + (this.gateWidth * 0.5 + 0.4) * pylonSide, 2, cz + half * side)
        }

        // Towers
        for(const sx of [ -1, 1 ])
            for(const sz of [ -1, 1 ])
                cuboid(1.2, 3.5, 1.2, cx + (half - 1.2) * sx, 3.8, cz + (half - 1.2) * sz)

        // Helipad
        cuboid(3.6, 0.12, 3.6, cx, 0.38, cz)

        // Ramp
        const rampQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rampAngle, 0, 0))
        cuboid(3, 0.2, 6, cx, 1.4, cz + 8, rampQuaternion)

        // Crates
        cuboid(1, 1, 1, cx - 12, 1.3, cz - 10)
        cuboid(0.7, 0.7, 0.7, cx - 12, 3, cz - 10)
        cuboid(1, 1, 1, cx + 12, 1.3, cz - 8)

        this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.25,
                restitution: 0,
                colliders
            }
        )
    }

    setRespawn()
    {
        // Register the compound as a respawn point
        this.game.respawns.items.set('base', {
            name: 'base',
            position: new THREE.Vector3(this.center.x, 4, this.center.z + this.size * 0.5 + 6),
            rotation: Math.PI,
        })
    }
}
