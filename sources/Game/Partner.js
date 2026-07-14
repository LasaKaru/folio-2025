import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from './Game.js'
import { MeshDefaultMaterial } from './Materials/MeshDefaultMaterial.js'

// Secret companion: unlocked by finding all 6 hidden eggs (Eggs.js).
// Follows the hero on foot and periodically swipes at anything within
// range -- a simple, cheap AI ally with no pathfinding, just seek-and-orbit.
// A second unit can be unlocked in the Garage for credits (see Garage.js
// "Partner upgrades" section); both units share the same damage/attack-rate
// stats, upgraded from the same place.
export class Partner
{
    // Follow slot for each unit: which side of the hero, how far behind.
    static SLOTS = [
        { side: -1, distance: 2.2 },
        { side: 1, distance: 2.6 },
    ]

    constructor()
    {
        this.game = Game.getInstance()

        this.unlocked = localStorage.getItem('circuitCity.partnerUnlocked') === 'true'
        this.active = this.unlocked && localStorage.getItem('circuitCity.partnerActive') !== 'false'
        this.secondUnlocked = localStorage.getItem('circuitCity.partnerSecondUnlocked') === 'true'

        // Base stats, before Garage upgrades (see applyUpgrades()) --
        // Garage.js multiplies these, it never sets attack values directly.
        this.baseDamage = 4
        this.baseRate = 0.9
        this.attackDamage = this.baseDamage
        this.attackRate = this.baseRate

        this.setMaterials()
        this.units = []
        this.createUnit(0)

        if(this.secondUnlocked)
            this.createUnit(1)

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

    createUnit(slotIndex)
    {
        const group = new THREE.Group()

        const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.13), this.materials.pants)
        legLeft.position.set(-0.09, 0.4, 0)
        group.add(legLeft)

        const legRight = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.13), this.materials.pants)
        legRight.position.set(0.09, 0.4, 0)
        group.add(legRight)

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.22), this.materials.jacket)
        torso.position.y = 0.625
        torso.castShadow = true
        group.add(torso)

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), this.materials.skin)
        head.position.y = 0.97
        group.add(head)

        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), this.materials.visor)
        visor.position.set(0, 0.99, 0.12)
        group.add(visor)

        group.scale.setScalar(1.5)
        group.visible = false
        this.game.scene.add(group)

        const unit = {
            group,
            legs: [ legLeft, legRight ],
            slot: Partner.SLOTS[slotIndex] ?? Partner.SLOTS[0],
            attackCooldown: 0,
            phase: 0,
        }

        this.units.push(unit)
        return unit
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

    // Garage-purchased: a second companion, credits-only (no secret to find).
    unlockSecond()
    {
        if(this.secondUnlocked)
            return

        this.secondUnlocked = true
        localStorage.setItem('circuitCity.partnerSecondUnlocked', 'true')

        if(this.units.length < 2)
            this.createUnit(1)
    }

    setActive(active)
    {
        this.active = active
        localStorage.setItem('circuitCity.partnerActive', active ? 'true' : 'false')
    }

    // Called by Garage.js after a partner upgrade purchase (or on load) --
    // Garage owns the upgrade levels, this just recomputes the live stats.
    applyUpgrades(damageMultiplier, rateMultiplier)
    {
        this.attackDamage = this.baseDamage * damageMultiplier
        this.attackRate = Math.max(0.2, this.baseRate / rateMultiplier)
    }

    update()
    {
        const onFoot = !!this.game.character?.active
        const visible = this.unlocked && this.active && onFoot
        const heroPosition = this.game.character?.position
        const heroAngle = this.game.character?.rotationY ?? 0
        const delta = this.game.ticker.deltaScaled

        this.units.forEach((unit, index) =>
        {
            const isSecondaryLocked = index === 1 && !this.secondUnlocked
            unit.group.visible = visible && !isSecondaryLocked

            if(!unit.group.visible)
                return

            const { side, distance } = unit.slot
            const targetX = heroPosition.x - Math.sin(heroAngle) * distance - Math.cos(heroAngle) * (0.8 * side)
            const targetZ = heroPosition.z - Math.cos(heroAngle) * distance + Math.sin(heroAngle) * (0.8 * side)

            const dx = targetX - unit.group.position.x
            const dz = targetZ - unit.group.position.z
            const dist = Math.hypot(dx, dz)

            if(dist > 0.2)
            {
                const speed = Math.min(dist * 3, 6)
                unit.group.position.x += (dx / dist) * speed * delta
                unit.group.position.z += (dz / dist) * speed * delta
                unit.group.rotation.y = Math.atan2(dx, dz)

                unit.phase += delta * speed * 4
                const swing = Math.sin(unit.phase) * 0.5
                unit.legs[0].rotation.x = swing
                unit.legs[1].rotation.x = -swing
            }

            unit.group.position.y = heroPosition.y - 0.7

            unit.attackCooldown -= delta
            if(unit.attackCooldown <= 0)
            {
                unit.attackCooldown = this.attackRate

                const attackOrigin = new THREE.Vector3(unit.group.position.x, unit.group.position.y + 0.9, unit.group.position.z)
                this.game.enemies?.tryHit(attackOrigin, 3, this.attackDamage)
            }
        })
    }
}
