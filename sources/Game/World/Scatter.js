import * as THREE from 'three/webgpu'
import { color, sin } from 'three/tsl'
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
        this.setShops()
        this.setTowers()
        this.setStones()
        this.setTrees()
        this.setGrassTufts()
        this.setPonds()

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

        // Downtown towers
        this.materials.towerA = create('#232042')
        this.materials.towerB = create('#2a1f3d')
        this.materials.towerC = create('#1e2b3d')
        this.materials.towerWindow = this.game.materials.createEmissive('scatterTowerWindow', '#00e5ff', 2.2)
        this.materials.towerWindowWarm = this.game.materials.createEmissive('scatterTowerWindowWarm', '#ffd23f', 2.2)
        this.materials.beacon = this.game.materials.createEmissive('scatterBeacon', '#ff2ea0', 3)

        // Shop strip
        this.materials.shopWall = create('#3a2b52')
        this.materials.shopSign = this.game.materials.createEmissive('scatterShopSign', '#ff2ea0', 2.4)
        this.materials.shopSignAlt = this.game.materials.createEmissive('scatterShopSignAlt', '#2fe0c8', 2.4)

        // Grass tufts
        this.materials.grassTuft = new MeshDefaultMaterial({
            colorNode: color('#1f8a5a'),
            hasCoreShadows: true,
            hasDropShadows: false,
            side: THREE.DoubleSide,
        })
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

        // Coastal cul-de-sac south-east, near the shore
        const culDeSac = { x: 48, z: 55 }
        const culDeSacHouses = 5
        for(let i = 0; i < culDeSacHouses; i++)
        {
            const angle = (i / culDeSacHouses) * Math.PI * 2
            const radius = 10 + this.random() * 4
            const x = culDeSac.x + Math.cos(angle) * radius
            const z = culDeSac.z + Math.sin(angle) * radius
            const rotationY = Math.round(this.random() * 4) * Math.PI * 0.5
            const material = [ this.materials.wallA, this.materials.wallB, this.materials.wallC ][i % 3]

            this.house(x, z, rotationY, material)
        }

        // Scattered farmhouses along the northern road
        this.house(-8, 95, 0, this.materials.wallA)
        this.house(2, 100, Math.PI * 0.5, this.materials.wallB)
        this.house(-16, 88, Math.PI, this.materials.wallC)
    }

    shop(x, z, rotationY, signMaterial)
    {
        const shop = new THREE.Group()
        shop.position.set(x, 0, z)
        shop.rotation.y = rotationY

        const width = 4.5
        const height = 3.2
        const depth = 4

        const base = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.shopWall)
        base.position.y = height * 0.5
        base.castShadow = true
        base.receiveShadow = true
        shop.add(base)

        // Flat awning
        const awning = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.2, 1.2), this.materials.roof)
        awning.position.set(0, height - 0.3, depth * 0.5 + 0.5)
        awning.castShadow = true
        shop.add(awning)

        // Storefront glass (wide window)
        const glass = new THREE.Mesh(new THREE.BoxGeometry(width - 1, 1.6, 0.1), this.materials.window)
        glass.position.set(0, 1.2, depth * 0.5 + 0.02)
        shop.add(glass)

        // Neon sign above the awning
        const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.5, 0.12), signMaterial)
        sign.position.set(0, height + 0.1, depth * 0.5 + 0.5)
        shop.add(sign)

        this.group.add(shop)

        const swap = Math.abs(Math.sin(rotationY)) > 0.5
        this.colliders.push({
            shape: 'cuboid',
            parameters: [ (swap ? depth : width) * 0.5, height * 0.5 + 0.9, (swap ? width : depth) * 0.5 ],
            position: { x, y: height * 0.5, z },
            category: 'floor',
        })
    }

    setShops()
    {
        // Commercial strip along the road east of the stone field
        const strip = { x: 92, z: 8 }
        const shopCount = 6

        for(let i = 0; i < shopCount; i++)
        {
            const x = strip.x
            const z = strip.z + (i - shopCount * 0.5) * 6
            const sign = i % 2 === 0 ? this.materials.shopSign : this.materials.shopSignAlt
            this.shop(x, z, Math.PI * 0.5, sign)
        }
    }

    tower(x, z, floors, material)
    {
        const width = 6 + this.random() * 2
        const depth = 6 + this.random() * 2
        const floorHeight = 3
        const height = floors * floorHeight

        const building = new THREE.Group()
        building.position.set(x, 0, z)

        const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
        body.position.y = height * 0.5
        body.castShadow = true
        body.receiveShadow = true
        building.add(body)

        // Rooftop beacon (blinking neon glow, always-on for readability from afar)
        const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 6), this.materials.beacon)
        beacon.position.y = height + 0.6
        building.add(beacon)

        // Window bands: one thin emissive strip per couple of floors on each of the 4 faces
        const windowMat = this.random() > 0.5 ? this.materials.towerWindow : this.materials.towerWindowWarm
        for(let f = 1; f < floors; f += 2)
        {
            const y = f * floorHeight
            const bandFront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, 0.4, 0.05), windowMat)
            bandFront.position.set(0, y, depth * 0.5 + 0.03)
            building.add(bandFront)

            const bandBack = bandFront.clone()
            bandBack.position.z = -(depth * 0.5 + 0.03)
            building.add(bandBack)

            const bandSideA = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, depth * 0.8), windowMat)
            bandSideA.position.set(width * 0.5 + 0.03, y, 0)
            building.add(bandSideA)

            const bandSideB = bandSideA.clone()
            bandSideB.position.x = -(width * 0.5 + 0.03)
            building.add(bandSideB)
        }

        this.group.add(building)

        this.colliders.push({
            shape: 'cuboid',
            parameters: [ width * 0.5, height * 0.5 + 0.9, depth * 0.5 ],
            position: { x, y: height * 0.5, z },
            category: 'floor',
        })
    }

    setTowers()
    {
        // Downtown skyline district, north-west of the map, away from the road missions
        const downtown = { x: -72, z: 58 }
        const towerMaterials = [ this.materials.towerA, this.materials.towerB, this.materials.towerC ]

        const layout = [
            { dx: 0, dz: 0, floors: 8 },
            { dx: 12, dz: -4, floors: 5 },
            { dx: -11, dz: 6, floors: 6 },
            { dx: 6, dz: 14, floors: 10 },
            { dx: -6, dz: -13, floors: 4 },
            { dx: 18, dz: 10, floors: 6 },
            { dx: -18, dz: -6, floors: 5 },
        ]

        for(let i = 0; i < layout.length; i++)
        {
            const { dx, dz, floors } = layout[i]
            this.tower(downtown.x + dx, downtown.z + dz, floors, towerMaterials[i % towerMaterials.length])
        }
    }

    setStones()
    {
        const stoneGeometry = new THREE.DodecahedronGeometry(1, 0)

        const placeStone = (x, z, size) =>
        {
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

        // Main ring of shore stones
        for(let i = 0; i < 42; i++)
        {
            const angle = this.random() * Math.PI * 2
            const radius = 45 + this.random() * 25
            const x = Math.cos(angle) * radius + 20
            const z = Math.sin(angle) * radius + 10
            const size = 0.5 + this.random() * 1.7

            placeStone(x, z, size)
        }

        // Extra scattered clusters near the tree groves and outlying districts
        const clusters = [
            { x: -20, z: 20, radius: 12, count: 8 },
            { x: 30, z: 90, radius: 14, count: 8 },
            { x: -80, z: -40, radius: 16, count: 10 },
            { x: 66, z: -34, radius: 10, count: 6 },
        ]

        for(const cluster of clusters)
        {
            for(let i = 0; i < cluster.count; i++)
            {
                const angle = this.random() * Math.PI * 2
                const radius = this.random() * cluster.radius
                const x = cluster.x + Math.cos(angle) * radius
                const z = cluster.z + Math.sin(angle) * radius
                const size = 0.4 + this.random() * 1.4

                placeStone(x, z, size)
            }
        }
    }

    setTrees()
    {
        const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6)
        const canopyGeometry = new THREE.IcosahedronGeometry(1, 1)

        const patches = [
            { x: 20, z: -62, radius: 16, count: 14 },
            { x: -52, z: 12, radius: 16, count: 14 },
            { x: 6, z: 70, radius: 14, count: 12 },
            { x: 66, z: -34, radius: 12, count: 10 },
            { x: -20, z: 20, radius: 14, count: 10 },
            { x: 30, z: 90, radius: 16, count: 12 },
            { x: -80, z: -40, radius: 18, count: 14 },
            { x: 12, z: 18, radius: 14, count: 12 },
            { x: -35, z: 65, radius: 16, count: 14 },
            { x: 78, z: 30, radius: 14, count: 12 },
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

    setGrassTufts()
    {
        // Cheap decorative grass clumps (crossed quads) around villages, hamlets and the shop strip
        const clusters = [
            { x: -30, z: 42, radius: 20, count: 60 },
            { x: -45, z: -34, radius: 14, count: 30 },
            { x: 48, z: 55, radius: 16, count: 40 },
            { x: 92, z: 8, radius: 20, count: 40 },
            { x: -72, z: 58, radius: 24, count: 40 },
        ]

        let total = 0
        for(const cluster of clusters)
            total += cluster.count

        const bladeGeometry = new THREE.PlaneGeometry(0.6, 0.7)
        bladeGeometry.translate(0, 0.35, 0)

        const instanced = new THREE.InstancedMesh(bladeGeometry, this.materials.grassTuft, total * 2)
        instanced.castShadow = false
        instanced.receiveShadow = true

        const dummy = new THREE.Object3D()
        let index = 0

        for(const cluster of clusters)
        {
            for(let i = 0; i < cluster.count; i++)
            {
                const angle = this.random() * Math.PI * 2
                const radius = this.random() * cluster.radius
                const x = cluster.x + Math.cos(angle) * radius
                const z = cluster.z + Math.sin(angle) * radius
                const scale = 0.7 + this.random() * 0.6

                // Two crossed blades per tuft for a fuller silhouette from any angle
                for(let b = 0; b < 2; b++)
                {
                    dummy.position.set(x, 0, z)
                    dummy.rotation.set(0, this.random() * Math.PI + b * Math.PI * 0.5, 0)
                    dummy.scale.setScalar(scale)
                    dummy.updateMatrix()
                    instanced.setMatrixAt(index, dummy.matrix)
                    index++
                }
            }
        }

        instanced.instanceMatrix.needsUpdate = true
        this.group.add(instanced)
    }

    setPonds()
    {
        const geometry = new THREE.CircleGeometry(1, 32)
        geometry.rotateX(- Math.PI * 0.5)

        // Cheap shimmer driven by the existing global elapsed-time uniform,
        // no per-frame JS tick needed.
        const shimmer = sin(this.game.ticker.elapsedScaledUniform.mul(1.4)).mul(0.08).add(0.92)
        const pondMaterial = new MeshDefaultMaterial({
            colorNode: color('#1fb7ff').mul(shimmer),
            hasCoreShadows: false,
            hasDropShadows: false,
        })

        const ponds = [
            { x: 8, z: 40, radius: 5 },
            { x: -60, z: 30, radius: 4 },
            { x: 55, z: -50, radius: 6 },
        ]

        for(const pond of ponds)
        {
            const mesh = new THREE.Mesh(geometry, pondMaterial)
            mesh.position.set(pond.x, 0.05, pond.z)
            mesh.scale.setScalar(pond.radius)
            mesh.receiveShadow = true
            this.group.add(mesh)
        }
    }
}
