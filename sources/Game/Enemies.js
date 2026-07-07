import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from './Game.js'
import { Events } from './Events.js'
import { MeshDefaultMaterial } from './Materials/MeshDefaultMaterial.js'

// Havoc raiders. They guard their camps, chase the player on sight and
// swing at the hero when close. Blaster bolts and truck bumpers both work.
export class Enemies
{
    static STATE_GUARD = 1
    static STATE_CHASE = 2
    static STATE_DEAD = 3

    constructor()
    {
        this.game = Game.getInstance()

        this.camps = []
        this.aggroRadius = 16
        this.attackRadius = 1.8
        this.attackDamage = 12
        this.attackRate = 1.1
        this.runOverSpeed = 6
        this.killReward = 25

        this.setSounds()
        this.setMaterials()
        this.setGeometries()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.hit = this.game.audio.register({
            path: 'sounds/hits/defaults/Impact Soft 02.mp3',
            autoplay: false,
            volume: 0.4,
            antiSpam: 0.1,
        })
        this.sounds.die = this.game.audio.register({
            path: 'sounds/explosions/SmallImpactMediumE PE281203.mp3',
            autoplay: false,
            volume: 0.45,
            antiSpam: 0.1,
        })
    }

    setMaterials()
    {
        const create = (hex) => new MeshDefaultMaterial({
            colorNode: color(hex),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        this.materials = {}
        this.materials.body = create('#33203d')
        this.materials.bodyBoss = create('#12041a')
        this.materials.limbs = create('#241726')
        this.materials.visor = this.game.materials.createEmissive('raiderVisor', '#ff2222', 3)
        this.materials.totem = this.game.materials.createEmissive('raiderTotem', '#ff4a2a', 2.2)
    }

    setGeometries()
    {
        this.geometries = {}

        this.geometries.leg = new THREE.BoxGeometry(0.13, 0.4, 0.13)
        this.geometries.leg.translate(0, -0.2, 0)

        this.geometries.arm = new THREE.BoxGeometry(0.1, 0.38, 0.1)
        this.geometries.arm.translate(0, -0.19, 0)

        this.geometries.torso = new THREE.BoxGeometry(0.4, 0.45, 0.24)
        this.geometries.head = new THREE.BoxGeometry(0.26, 0.24, 0.24)
        this.geometries.visor = new THREE.BoxGeometry(0.28, 0.07, 0.06)
        this.geometries.totem = new THREE.ConeGeometry(0.5, 4, 6)
    }

    spawnCamp(description)
    {
        const camp = {
            center: description.center,
            enemies: [],
            events: new Events(),
            cleared: false,
            group: new THREE.Group(),
        }

        // Totem so the camp is visible from far away
        const totem = new THREE.Mesh(this.geometries.totem, this.materials.totem)
        totem.position.set(description.center.x, 2, description.center.z)
        camp.group.add(totem)
        camp.totem = totem

        for(let i = 0; i < description.count; i++)
        {
            const boss = description.boss && i === 0
            const angle = (i / description.count) * Math.PI * 2
            const radius = boss ? 0 : 3 + Math.random() * (description.radius ?? 8)

            camp.enemies.push(this.createEnemy(
                {
                    x: description.center.x + Math.cos(angle) * radius,
                    z: description.center.z + Math.sin(angle) * radius,
                },
                boss,
                camp
            ))
        }

        this.game.scene.add(camp.group)
        this.camps.push(camp)

        return camp
    }

    createEnemy(position, boss, camp)
    {
        const group = new THREE.Group()

        const legLeft = new THREE.Mesh(this.geometries.leg, this.materials.limbs)
        legLeft.position.set(-0.1, 0.4, 0)
        group.add(legLeft)

        const legRight = new THREE.Mesh(this.geometries.leg, this.materials.limbs)
        legRight.position.set(0.1, 0.4, 0)
        group.add(legRight)

        const torso = new THREE.Mesh(this.geometries.torso, boss ? this.materials.bodyBoss : this.materials.body)
        torso.position.y = 0.625
        torso.castShadow = true
        group.add(torso)

        const head = new THREE.Mesh(this.geometries.head, boss ? this.materials.bodyBoss : this.materials.body)
        head.position.y = 0.97
        group.add(head)

        const visor = new THREE.Mesh(this.geometries.visor, this.materials.visor)
        visor.position.set(0, 0.99, 0.12)
        group.add(visor)

        const armLeft = new THREE.Mesh(this.geometries.arm, this.materials.limbs)
        armLeft.position.set(-0.26, 0.82, 0)
        group.add(armLeft)

        const armRight = new THREE.Mesh(this.geometries.arm, this.materials.limbs)
        armRight.position.set(0.26, 0.82, 0)
        group.add(armRight)

        group.scale.setScalar(boss ? 2.4 : 1.6)
        group.position.set(position.x, 0, position.z)
        camp.group.add(group)

        return {
            group,
            legLeft, legRight, armLeft, armRight,
            camp,
            boss,
            hp: boss ? 12 : 3,
            state: Enemies.STATE_GUARD,
            home: { x: position.x, z: position.z },
            speed: boss ? 4.2 : 3.2,
            phase: Math.random() * Math.PI * 2,
            attackCooldown: 0,
            deadTime: 0,
            flash: 0,
        }
    }

    getTarget()
    {
        if(this.game.character && this.game.character.active)
            return { position: this.game.character.position, onFoot: true }

        return { position: this.game.player.position, onFoot: false }
    }

    tryHit(position, radius, damage)
    {
        for(const camp of this.camps)
        {
            for(const enemy of camp.enemies)
            {
                if(enemy.state === Enemies.STATE_DEAD)
                    continue

                const scale = enemy.boss ? 2.4 : 1.6
                const distance = Math.hypot(
                    position.x - enemy.group.position.x,
                    position.y - (enemy.group.position.y + 0.8 * scale),
                    position.z - enemy.group.position.z
                )

                if(distance < radius + (enemy.boss ? 1 : 0.4))
                {
                    enemy.hp -= damage
                    enemy.flash = 0.15

                    if(enemy.hp <= 0)
                        this.kill(enemy)
                    else
                        this.sounds.hit.play()

                    return true
                }
            }
        }

        return false
    }

    kill(enemy)
    {
        enemy.state = Enemies.STATE_DEAD
        enemy.deadTime = 2.5
        this.sounds.die.play()

        // Reward
        this.game.missions.addCash(this.killReward)
        this.game.achievements.addProgress('kills')

        // Camp cleared?
        const alive = enemy.camp.enemies.filter((item) => item.state !== Enemies.STATE_DEAD)
        enemy.camp.events.trigger('kill', [ enemy.camp.enemies.length - alive.length, enemy.camp.enemies.length ])

        if(alive.length === 0 && !enemy.camp.cleared)
        {
            enemy.camp.cleared = true
            enemy.camp.events.trigger('cleared')
        }
    }

    removeCamp(camp)
    {
        this.game.scene.remove(camp.group)
        const index = this.camps.indexOf(camp)
        if(index !== -1)
            this.camps.splice(index, 1)
    }

    update()
    {
        const delta = this.game.ticker.deltaScaled
        const elapsed = this.game.ticker.elapsed
        const target = this.getTarget()
        const vehicleSpeed = this.game.physicalVehicle ? this.game.physicalVehicle.xzSpeed : 0

        for(const camp of this.camps)
        {
            // Totem pulse
            if(camp.totem)
                camp.totem.scale.y = 1 + Math.sin(elapsed * 2) * 0.08

            for(const enemy of camp.enemies)
            {
                const object = enemy.group

                // Dying: fall, then sink away
                if(enemy.state === Enemies.STATE_DEAD)
                {
                    enemy.deadTime -= delta
                    object.rotation.x = Math.max(-Math.PI * 0.5, object.rotation.x - delta * 5)

                    if(enemy.deadTime < 0.8)
                        object.position.y -= delta * 1.5

                    if(enemy.deadTime <= 0)
                        object.visible = false

                    continue
                }

                // Hit flash
                if(enemy.flash > 0)
                {
                    enemy.flash -= delta
                    const pulse = 1 + Math.sin(enemy.flash * 40) * 0.15
                    object.scale.setScalar((enemy.boss ? 2.4 : 1.6) * pulse)
                }

                enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta)

                const targetDistance = Math.hypot(
                    target.position.x - object.position.x,
                    target.position.z - object.position.z
                )
                const homeDistance = Math.hypot(
                    enemy.home.x - object.position.x,
                    enemy.home.z - object.position.z
                )

                // State transitions
                if(enemy.state === Enemies.STATE_GUARD && targetDistance < this.aggroRadius)
                    enemy.state = Enemies.STATE_CHASE
                else if(enemy.state === Enemies.STATE_CHASE && (targetDistance > this.aggroRadius * 2 || homeDistance > 40))
                    enemy.state = Enemies.STATE_GUARD

                // Movement
                let moveX = 0
                let moveZ = 0
                let moveSpeed = 0

                if(enemy.state === Enemies.STATE_CHASE)
                {
                    moveX = target.position.x - object.position.x
                    moveZ = target.position.z - object.position.z
                    moveSpeed = enemy.speed
                }
                else if(homeDistance > 1.5)
                {
                    moveX = enemy.home.x - object.position.x
                    moveZ = enemy.home.z - object.position.z
                    moveSpeed = 1.4
                }

                if(moveSpeed > 0)
                {
                    const length = Math.hypot(moveX, moveZ) || 1
                    object.position.x += (moveX / length) * moveSpeed * delta
                    object.position.z += (moveZ / length) * moveSpeed * delta
                    object.rotation.y = Math.atan2(moveX, moveZ)

                    enemy.phase += delta * moveSpeed * 4
                    const swing = Math.sin(enemy.phase) * 0.6
                    enemy.legLeft.rotation.x = swing
                    enemy.legRight.rotation.x = -swing
                    enemy.armLeft.rotation.x = -swing * 0.8
                    enemy.armRight.rotation.x = swing * 0.8
                    object.position.y = Math.abs(Math.sin(enemy.phase)) * 0.06
                }
                else
                {
                    enemy.legLeft.rotation.x = 0
                    enemy.legRight.rotation.x = 0
                    object.position.y = 0
                }

                // Run over by the truck
                if(!target.onFoot && targetDistance < (enemy.boss ? 3 : 2.2) && vehicleSpeed > this.runOverSpeed)
                {
                    this.kill(enemy)
                    continue
                }

                // Melee the hero
                if(target.onFoot && targetDistance < this.attackRadius * (enemy.boss ? 2 : 1) && enemy.attackCooldown === 0)
                {
                    enemy.attackCooldown = this.attackRate

                    // Wind-up arms
                    enemy.armLeft.rotation.x = Math.PI * 0.9
                    enemy.armRight.rotation.x = Math.PI * 0.9

                    if(this.game.character)
                        this.game.character.damage(enemy.boss ? 22 : this.attackDamage)
                }
            }
        }
    }
}
