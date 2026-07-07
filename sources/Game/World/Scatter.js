import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

// Extra world dressing: village houses, scattered stones and neon trees.
// Deterministic layout (seeded PRNG) so the island always looks the same.
export class Scatter
{
    constructor()
    {
        this.game = Game.getInstance()

        // Small deterministic PRNG (mulberry32)
        let seed = 1337
        this.random = () =>
        {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
            return ((t ^ t >>> 14) >>> 0) / 4294967296
        }

        this.group = new THREE.Group()
        this.colliders = []

        this.setMaterials()
        this.setHouses()
        this.setStones()
        this.setTrees()

        this.game.scene.add(this.group)

        if(this.colliders.length)
        {
            this.game.objects.add(null, {
                type: 'fixed',
                friction: 0.3,
                restitution: 0,
                colliders: this.colliders,
            })
        }
    }

    setMaterials()
    {
        const create = (hex) => new MeshDefaultMaterial({
            colorNode: color(hex),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        this.materials = {}
        this.materials.wallA = create('#4a3a6b')
        this.materials.wallB = create('#5d3557')
        this.materials.wallC = create('#37505f')
        this.materials.roof = create('#241b38')
        this.materials.stone = create('#6d6485')
        this.materials.stoneDark = create('#4a4360')
        this.materials.trunk = create('#3d2b4a')
        this.materials.door = this.game.materials.createEmissive('scatterDoor', '#ffd23f', 1.6)
        this.materials.window = this.game.materials.createEmissive('scatterWindow', '#00e5ff', 1.6)

        this.canopyMaterials = [
            create('#ff2f92'),
            create('#2fd4a0'),
            create('#b56bff'),
            create('#ff8c3a'),
        ]
    }

    house(x, z, rotationY, wallMaterial)
    {
        const house = new THREE.Group()
        house.position.set(x, 0, z)
        house.rotation.y = rotationY

        const width = 5
        const height = 3
        const depth = 4.5

        const base = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial)
        base.position.y = height * 0.5
        base.castShadow = true
        base.receiveShadow = true
        house.add(base)

        const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.78, 1.8, 4), this.materials.roof)
        roof.position.y = height + 0.9
        roof.rotation.y = Math.PI * 0.25
        roof.castShadow = true
        house.add(roof)

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), this.materials.door)
        door.position.set(0, 0.8, depth * 0.5 + 0.02)
        house.add(door)

        for(const side of [ -1.5, 1.5 ])
        {
            const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), this.materials.window)
            windowMesh.position.set(side, 1.8, depth * 0.5 + 0.02)
            house.add(windowMesh)
        }

        this.group.add(house)

        // Collider (axis-aligned enough: houses snap to 90° rotations)
        const swap = Math.abs(Math.sin(rotationY)) > 0.5
        this.colliders.push({
            shape: 'cuboid',
            parameters: [ (swap ? depth : width) * 0.5, height * 0.5 + 0.9, (swap ? width : depth) * 0.5 ],
            position: { x, y: height * 0.5, z },
            category: 'floor',
        })
    }

    setHouses()
    {
        // Fishing village north-west (story chapter 2 happens here)
        const village = { x: -30, z: 42 }
        const villageHouses = 7

        for(let i = 0; i < villageHouses; i++)
        {
            const angle = (i / villageHouses) * Math.PI * 2 + 0.4
            const radius = 14 + this.random() * 5
            const x = village.x + Math.cos(angle) * radius
            const z = village.z + Math.sin(angle) * radius
            const rotationY = Math.round(this.random() * 4) * Math.PI * 0.5
            const material = [ this.materials.wallA, this.materials.wallB, this.materials.wallC ][i % 3]

            this.house(x, z, rotationY, material)
        }

        // Lone hamlet on the road to the far west
        this.house(-45, -38, Math.PI * 0.5, this.materials.wallB)
        this.house(-40, -30, 0, this.materials.wallC)
        this.house(-50, -30, Math.PI, this.materials.wallA)
    }

    setStones()
    {
        const stoneGeometry = new THREE.DodecahedronGeometry(1, 0)

        for(let i = 0; i < 26; i++)
        {
            const angle = this.random() * Math.PI * 2
            const radius = 45 + this.random() * 25
            const x = Math.cos(angle) * radius + 20
            const z = Math.sin(angle) * radius + 10
            const size = 0.5 + this.random() * 1.7

            const stone = new THREE.Mesh(stoneGeometry, this.random() > 0.5 ? this.materials.stone : this.materials.stoneDark)
            stone.position.set(x, size * 0.4, z)
            stone.scale.setScalar(size)
            stone.rotation.set(this.random() * Math.PI, this.random() * Math.PI, this.random() * Math.PI)
            stone.castShadow = true
            stone.receiveShadow = true
            this.group.add(stone)

            // Only the big ones block the truck
            if(size > 1.5)
            {
                this.colliders.push({
                    shape: 'ball',
                    parameters: [ size * 0.8 ],
                    position: { x, y: size * 0.4, z },
                    category: 'floor',
                })
            }
        }
    }

    setTrees()
    {
        const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6)
        const canopyGeometry = new THREE.IcosahedronGeometry(1, 1)

        const patches = [
            { x: 20, z: -62, radius: 16, count: 10 },
            { x: -52, z: 12, radius: 16, count: 10 },
            { x: 6, z: 70, radius: 14, count: 8 },
            { x: 66, z: -34, radius: 12, count: 8 },
        ]

        for(const patch of patches)
        {
            for(let i = 0; i < patch.count; i++)
            {
                const angle = this.random() * Math.PI * 2
                const radius = this.random() * patch.radius
                const x = patch.x + Math.cos(angle) * radius
                const z = patch.z + Math.sin(angle) * radius
                const scale = 0.8 + this.random() * 0.9

                const tree = new THREE.Group()
                tree.position.set(x, 0, z)
                tree.scale.setScalar(scale)

                const trunk = new THREE.Mesh(trunkGeometry, this.materials.trunk)
                trunk.position.y = 1.2
                trunk.castShadow = true
                tree.add(trunk)

                const material = this.canopyMaterials[Math.floor(this.random() * this.canopyMaterials.length)]

                const canopy = new THREE.Mesh(canopyGeometry, material)
                canopy.position.y = 2.9
                canopy.scale.set(1.3, 1.1, 1.3)
                canopy.castShadow = true
                tree.add(canopy)

                const canopyTop = new THREE.Mesh(canopyGeometry, material)
                canopyTop.position.y = 3.9
                canopyTop.scale.setScalar(0.7)
                tree.add(canopyTop)

                this.group.add(tree)
            }
        }
    }
}
