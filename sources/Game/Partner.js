import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from './Game.js'
import { MeshDefaultMaterial } from './Materials/MeshDefaultMaterial.js'

// Secret companion: unlocked by finding all 6 hidden eggs (Eggs.js).
// Follows the hero on foot and periodically swipes at anything within
// range -- a simple, cheap AI ally with no pathfinding, just seek-and-orbit.
export class Partner
{
    constructor()
    {
        this.game = Game.getInstance()

        this.unlocked = localStorage.getItem('circuitCity.partnerUnlocked') === 'true'
        this.active = this.unlocked && localStorage.getItem('circuitCity.partnerActive') !== 'false'

        this.followDistance = 2.2
        this.attackRange = 3
        this.attackDamage = 4
        this.attackRate = 0.9
        this.attackCooldown = 0

        this.setMaterials()
        this.setMesh()
        this.setToggle()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setMaterials()
    {
        this.materials = {}
        this.materials.skin = new MeshDefaultMaterial({ colorNode: color('#ffc8a8'), hasCoreShadows: true, hasDropShadows: true })
        this.materials.jacket = new MeshDefaultMaterial({ colorNode: color('#00e5ff'), hasCoreShadows: true, hasDropShadows: true })
        this.materials.pants = new MeshDefaultMaterial({ colorNode: color('#2b2436'), hasCoreShadows: true, hasDropShadows: true })
        this.materials.visor = this.game.materials.createEmissive('partnerVisor', '#ff2ea0', 2)
    }

    setMesh()
    {
        this.group = new THREE.Group()

        const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.13), this.materials.pants)
        legLeft.position.set(-0.09, 0.4, 0)
        this.group.add(legLeft)

        const legRight = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.13), this.materials.pants)
        legRight.position.set(0.09, 0.4, 0)
        this.group.add(legRight)
        this.legs = [ legLeft, legRight ]

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.22), this.materials.jacket)
        torso.position.y = 0.625
        torso.castShadow = true
        this.group.add(torso)

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), this.materials.skin)
        head.position.y = 0.97
        this.group.add(head)

        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), this.materials.visor)
        visor.position.set(0, 0.99, 0.12)
        this.group.add(visor)

        this.group.scale.setScalar(1.5)
        this.group.visible = false
        this.game.scene.add(this.group)
    }

    setToggle()
    {
        this.game.inputs.addActions([
            { name: 'partnerToggle', categories: [ 'wandering' ], keys: [ 'Keyboard.KeyP' ] },
        ])
        this.game.inputs.events.on('partnerToggle', (action) =>
        {
            if(action.active && this.unlocked)
                this.setActive(!this.active)
        })
    }

    unlock()
    {
        if(this.unlocked)
            return

        this.unlocked = true
        localStorage.setItem('circuitCity.partnerUnlocked', 'true')
        this.setActive(true)

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🤝 Partner unlocked!</div>
                </div>
                <div class="bottom">
                    <div class="description">A partner now fights alongside you on foot. Press P to bench/summon them.</div>
                </div>
            `,
            'secret',
            8,
            null,
            'partner-unlocked'
        )
    }

    setActive(active)
    {
        this.active = active
        localStorage.setItem('circuitCity.partnerActive', active ? 'true' : 'false')
    }

    update()
    {
        const onFoot = !!this.game.character?.active
        this.group.visible = this.unlocked && this.active && onFoot

        if(!this.group.visible)
            return

        const delta = this.game.ticker.deltaScaled
        const heroPosition = this.game.character.position
        const heroAngle = this.game.character.rotationY

        // Hover a step behind and to the side of the hero
        const targetX = heroPosition.x - Math.sin(heroAngle) * this.followDistance - Math.cos(heroAngle) * 0.8
        const targetZ = heroPosition.z - Math.cos(heroAngle) * this.followDistance + Math.sin(heroAngle) * 0.8

        const dx = targetX - this.group.position.x
        const dz = targetZ - this.group.position.z
        const distance = Math.hypot(dx, dz)

        if(distance > 0.2)
        {
            const speed = Math.min(distance * 3, 6)
            this.group.position.x += (dx / distance) * speed * delta
            this.group.position.z += (dz / distance) * speed * delta
            this.group.rotation.y = Math.atan2(dx, dz)

            this.phase = (this.phase ?? 0) + delta * speed * 4
            const swing = Math.sin(this.phase) * 0.5
            this.legs[0].rotation.x = swing
            this.legs[1].rotation.x = -swing
        }

        this.group.position.y = heroPosition.y - 0.7

        // Auto-attack anything within range
        this.attackCooldown -= delta
        if(this.attackCooldown <= 0)
        {
            this.attackCooldown = this.attackRate

            const attackOrigin = new THREE.Vector3(this.group.position.x, this.group.position.y + 0.9, this.group.position.z)
            this.game.enemies?.tryHit(attackOrigin, this.attackRange, this.attackDamage)
        }
    }
}
