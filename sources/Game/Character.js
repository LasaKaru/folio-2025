import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from './Game.js'
import { Player } from './Player.js'
import { MeshDefaultMaterial } from './Materials/MeshDefaultMaterial.js'

// The on-foot hero. Press G near the truck to hop out and explore,
// C to switch between third and first person, X (or click) to shoot,
// SPACE to jump. Press G again near the truck to drive.
export class Character
{
    static CAMERA_ORBIT = 'orbit'
    static CAMERA_FIRST_PERSON = 'firstPerson'

    constructor()
    {
        this.game = Game.getInstance()

        this.active = false
        this.cameraMode = Character.CAMERA_ORBIT
        this.rotationY = 0
        this.position = new THREE.Vector3()
        this.velocity = new THREE.Vector3()
        this.walkPhase = 0
        this.moving = false
        this.sprinting = false
        this.jumpCooldown = 0

        this.health = { current: 100, max: 100, lastHitAt: -100, regenDelay: 6, regenRate: 12, dead: false }

        this.fp = { yaw: 0, pitch: -0.1, baseFov: this.game.view.camera.fov, fov: 70 }

        this.shooting = { cooldown: 0, rate: 0.2, projectiles: [], speed: 45, ttl: 1.4 }

        this.setSounds()
        this.setVisual()
        this.setPhysics()
        this.setHud()
        this.setInputs()
        this.setPointerLock()

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 2)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 6)

        // First-person camera override, after View (7), before Rendering (998)
        this.game.ticker.events.on('tick', () =>
        {
            this.updateCamera()
        }, 900)
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.shoot = this.game.audio.register({
            path: 'sounds/swoosh/Swoosh 02.mp3',
            autoplay: false,
            volume: 0.35,
            antiSpam: 0.1,
        })
        this.sounds.hurt = this.game.audio.register({
            path: 'sounds/explosions/SmallImpactMediumE PE281202.mp3',
            autoplay: false,
            volume: 0.4,
            antiSpam: 0.3,
        })
    }

    setVisual()
    {
        const create = (hex) => new MeshDefaultMaterial({
            colorNode: color(hex),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        const skin = create('#ffc8a8')
        const jacket = create('#00e5ff')
        const pants = create('#2b2436')
        const visor = this.game.materials.createEmissive('heroVisor', '#ff2ea0', 2)

        const legGeometry = new THREE.BoxGeometry(0.13, 0.4, 0.13)
        legGeometry.translate(0, -0.2, 0)
        const armGeometry = new THREE.BoxGeometry(0.1, 0.38, 0.1)
        armGeometry.translate(0, -0.19, 0)

        this.group = new THREE.Group()

        this.legLeft = new THREE.Mesh(legGeometry, pants)
        this.legLeft.position.set(-0.09, 0.4, 0)
        this.group.add(this.legLeft)

        this.legRight = new THREE.Mesh(legGeometry, pants)
        this.legRight.position.set(0.09, 0.4, 0)
        this.group.add(this.legRight)

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.22), jacket)
        torso.position.y = 0.625
        torso.castShadow = true
        this.group.add(torso)

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skin)
        head.position.y = 0.97
        this.group.add(head)

        // Visor strip so the hero reads as "the one"
        const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), visor)
        visorMesh.position.set(0, 0.99, 0.11)
        this.group.add(visorMesh)

        this.armLeft = new THREE.Mesh(armGeometry, jacket)
        this.armLeft.position.set(-0.23, 0.82, 0)
        this.group.add(this.armLeft)

        this.armRight = new THREE.Mesh(armGeometry, skin)
        this.armRight.position.set(0.23, 0.82, 0)
        this.group.add(this.armRight)

        this.group.scale.setScalar(1.5)
        this.group.visible = false
        this.game.scene.add(this.group)

        // Projectile assets
        this.projectileGeometry = new THREE.IcosahedronGeometry(0.14, 1)
        this.projectileMaterial = this.game.materials.createEmissive('blasterBolt', '#7dffea', 3.5)
    }

    setPhysics()
    {
        // Created directly through Physics (not Objects) so the world's
        // auto-reset/culling never disables or teleports the hero's body
        this.physical = this.game.physics.getPhysical({
            type: 'dynamic',
            position: { x: 0, y: 2, z: 0 },
            canSleep: false,
            friction: 0.1,
            restitution: 0,
            mass: 8,
            colliders: [
                { shape: 'cylinder', parameters: [ 0.7, 0.35 ], category: 'object' },
            ]
        })

        this.body = this.physical.body
        this.body.setEnabledRotations(false, false, false, true)
        this.body.setEnabled(false)
    }

    setHud()
    {
        this.hud = {}
        this.hud.healthFill = this.game.domElement.querySelector('.js-health-fill')
        this.hud.hint = this.game.domElement.querySelector('.js-foot-hint')
        this.hud.damageFlash = this.game.domElement.querySelector('.js-damage-flash')
        this.updateHealthHud()
    }

    updateHealthHud()
    {
        if(this.hud.healthFill)
        {
            const ratio = Math.max(0, this.health.current / this.health.max)
            this.hud.healthFill.style.transform = `scaleX(${ratio})`
            this.hud.healthFill.classList.toggle('is-low', ratio < 0.3)
        }
    }

    setInputs()
    {
        this.game.inputs.addActions([
            { name: 'vehicleToggle', categories: [ 'wandering' ], keys: [ 'Keyboard.KeyG' ] },
            { name: 'shoot',         categories: [ 'wandering' ], keys: [ 'Keyboard.KeyX' ] },
            { name: 'cameraMode',    categories: [ 'wandering' ], keys: [ 'Keyboard.KeyC' ] },
        ])

        this.game.inputs.events.on('vehicleToggle', (action) =>
        {
            if(action.active)
                this.toggleVehicle()
        })

        this.game.inputs.events.on('cameraMode', (action) =>
        {
            if(action.active)
                this.toggleCameraMode()
        })

        this.game.inputs.events.on('shoot', (action) =>
        {
            if(action.active)
                this.wantsToShoot = true
        })

        // Jump reuses the suspensions key (SPACE) while on foot
        this.game.inputs.events.on('suspensions', (action) =>
        {
            if(action.active && this.active)
                this.jump()
        })

        // Click to shoot when on foot
        this.game.canvasElement.addEventListener('pointerdown', (event) =>
        {
            if(this.active && event.button === 0)
                this.wantsToShoot = true
        })
    }

    setPointerLock()
    {
        document.addEventListener('mousemove', (event) =>
        {
            if(document.pointerLockElement !== this.game.canvasElement)
                return

            this.fp.yaw -= event.movementX * 0.0025
            this.fp.pitch -= event.movementY * 0.0025
            this.fp.pitch = Math.max(-1.35, Math.min(1.35, this.fp.pitch))
        })
    }

    toggleVehicle()
    {
        if(this.health.dead)
            return

        if(!this.active)
            this.exitVehicle()
        else
            this.enterVehicle()
    }

    exitVehicle()
    {
        // Only when the truck is roughly still and right side up
        if(this.game.physicalVehicle.xzSpeed > 8)
            return

        const vehiclePosition = this.game.physicalVehicle.position
        const forward = this.game.physicalVehicle.forward

        // Step out on the truck's left side
        const exitPosition = {
            x: vehiclePosition.x + forward.z * 2.4,
            y: vehiclePosition.y + 1,
            z: vehiclePosition.z - forward.x * 2.4,
        }

        this.active = true
        this.game.player.state = Player.STATE_LOCKED

        this.body.setEnabled(true)
        this.body.setTranslation(exitPosition, true)
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.position.set(exitPosition.x, exitPosition.y - 0.7, exitPosition.z)
        this.rotationY = Math.atan2(forward.x, forward.z)
        this.fp.yaw = this.rotationY

        this.group.visible = true

        if(this.hud.hint)
            this.hud.hint.classList.remove('is-hidden')

        // Achievement
        this.game.achievements.setProgress('onFoot', 1)
    }

    enterVehicle()
    {
        const vehiclePosition = this.game.physicalVehicle.position
        const distance = Math.hypot(vehiclePosition.x - this.position.x, vehiclePosition.z - this.position.z)

        if(distance > 4.5)
            return

        this.active = false
        this.group.visible = false
        this.body.setEnabled(false)
        this.game.player.state = Player.STATE_DEFAULT

        if(this.hud.hint)
            this.hud.hint.classList.add('is-hidden')

        // Leave first person cleanly when getting back behind the wheel
        if(this.cameraMode === Character.CAMERA_FIRST_PERSON && document.pointerLockElement)
            document.exitPointerLock()
    }

    toggleCameraMode()
    {
        if(this.cameraMode === Character.CAMERA_ORBIT)
        {
            this.cameraMode = Character.CAMERA_FIRST_PERSON
            this.fp.yaw = this.active ? this.rotationY : Math.atan2(this.game.physicalVehicle.forward.x, this.game.physicalVehicle.forward.z)
            this.fp.pitch = -0.05

            if(this.active)
            {
                try { this.game.canvasElement.requestPointerLock() }
                catch { /* pointer lock unavailable (touch, iframe) — keys still steer */ }
            }
        }
        else
        {
            this.cameraMode = Character.CAMERA_ORBIT
            this.game.view.camera.fov = this.fp.baseFov
            this.game.view.camera.updateProjectionMatrix()

            if(document.pointerLockElement)
                document.exitPointerLock()
        }
    }

    jump()
    {
        if(!this.active || this.jumpCooldown > 0)
            return

        // Roughly grounded: barely any vertical velocity
        if(Math.abs(this.body.linvel().y) > 0.8)
            return

        this.jumpCooldown = 0.6
        this.body.applyImpulse({ x: 0, y: 45, z: 0 }, true)
    }

    shoot()
    {
        if(this.shooting.cooldown > 0)
            return

        this.shooting.cooldown = this.shooting.rate

        // Direction: camera look in first person, facing on foot, truck forward while driving
        const direction = new THREE.Vector3()
        const origin = new THREE.Vector3()

        if(this.active)
        {
            if(this.cameraMode === Character.CAMERA_FIRST_PERSON)
            {
                direction.set(
                    Math.sin(this.fp.yaw) * Math.cos(this.fp.pitch),
                    Math.sin(this.fp.pitch),
                    Math.cos(this.fp.yaw) * Math.cos(this.fp.pitch)
                )
            }
            else
            {
                direction.set(Math.sin(this.rotationY), 0, Math.cos(this.rotationY))
            }

            origin.copy(this.position)
            origin.y += 1.3
            origin.addScaledVector(direction, 0.5)
        }
        else
        {
            // Drive-by
            const forward = this.game.physicalVehicle.forward
            direction.set(forward.x, 0, forward.z).normalize()
            origin.copy(this.game.physicalVehicle.position)
            origin.y += 1.2
            origin.addScaledVector(direction, 2)
        }

        const mesh = new THREE.Mesh(this.projectileGeometry, this.projectileMaterial)
        mesh.position.copy(origin)
        this.game.scene.add(mesh)

        this.shooting.count = (this.shooting.count ?? 0) + 1
        this.shooting.projectiles.push({
            mesh,
            velocity: direction.multiplyScalar(this.shooting.speed),
            ttl: this.shooting.ttl,
        })

        this.sounds.shoot.play()
    }

    damage(amount)
    {
        if(this.health.dead || !this.active)
            return

        this.health.current -= amount
        this.health.lastHitAt = this.game.ticker.elapsed
        this.updateHealthHud()
        this.sounds.hurt.play()

        if(this.hud.damageFlash)
        {
            this.hud.damageFlash.classList.remove('is-active')
            void this.hud.damageFlash.offsetWidth
            this.hud.damageFlash.classList.add('is-active')
        }

        if(this.health.current <= 0)
            this.die()
    }

    die()
    {
        this.health.dead = true

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">💀 Wasted</div>
                </div>
                <div class="bottom">
                    <div class="description">The raiders got you. Waking up back at a safe spot…</div>
                </div>
            `,
            'mission',
            5,
            null,
            'wasted'
        )

        this.game.overlay.show(() =>
        {
            const respawn = this.game.respawns.getClosest(this.position)
            this.body.setTranslation({ x: respawn.position.x, y: respawn.position.y, z: respawn.position.z }, true)
            this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            this.health.current = this.health.max
            this.health.dead = false
            this.updateHealthHud()
            this.game.overlay.hide()
        })
    }

    updatePrePhysics()
    {
        const delta = this.game.ticker.delta

        this.jumpCooldown = Math.max(0, this.jumpCooldown - delta)
        this.shooting.cooldown = Math.max(0, this.shooting.cooldown - delta)

        // Buffered: a shot requested during cooldown fires as soon as it ends
        if(this.wantsToShoot && this.shooting.cooldown === 0)
        {
            this.wantsToShoot = false
            if(!this.health.dead)
                this.shoot()
        }

        if(!this.active || this.health.dead)
            return

        // Input vector
        let inputX = 0
        let inputZ = 0

        if(this.game.inputs.actions.get('forward').active) inputZ += 1
        if(this.game.inputs.actions.get('backward').active) inputZ -= 1
        if(this.game.inputs.actions.get('left').active) inputX += 1
        if(this.game.inputs.actions.get('right').active) inputX -= 1

        this.sprinting = this.game.inputs.actions.get('boost').active

        const hasInput = inputX !== 0 || inputZ !== 0
        this.moving = hasInput

        // Camera-relative movement
        let yaw
        if(this.cameraMode === Character.CAMERA_FIRST_PERSON)
        {
            yaw = this.fp.yaw
        }
        else
        {
            const camera = this.game.view.camera
            yaw = Math.atan2(this.position.x - camera.position.x, this.position.z - camera.position.z)
        }

        const linvel = this.body.linvel()

        if(hasInput)
        {
            const inputAngle = Math.atan2(inputX, inputZ)
            const moveAngle = yaw + inputAngle
            const speed = this.sprinting ? 8 : 4.5

            this.body.setLinvel({
                x: Math.sin(moveAngle) * speed,
                y: linvel.y,
                z: Math.cos(moveAngle) * speed,
            }, true)

            // Face the walk direction (in first person, face the camera yaw)
            this.rotationY = this.cameraMode === Character.CAMERA_FIRST_PERSON ? this.fp.yaw : moveAngle
        }
        else
        {
            this.body.setLinvel({ x: linvel.x * 0.7, y: linvel.y, z: linvel.z * 0.7 }, true)

            if(this.cameraMode === Character.CAMERA_FIRST_PERSON)
                this.rotationY = this.fp.yaw
        }
    }

    updatePostPhysics()
    {
        const delta = this.game.ticker.delta
        const elapsed = this.game.ticker.elapsed

        // Projectiles always update (drive-by too)
        // Marched in ≤1m substeps so bolts can't tunnel through enemies at low frame rates
        const deltaScaled = this.game.ticker.deltaScaled
        for(let i = this.shooting.projectiles.length - 1; i >= 0; i--)
        {
            const projectile = this.shooting.projectiles[i]
            projectile.ttl -= deltaScaled

            let dead = projectile.ttl <= 0

            const travel = this.shooting.speed * deltaScaled
            const steps = Math.max(1, Math.ceil(travel))

            for(let step = 0; step < steps && !dead; step++)
            {
                projectile.mesh.position.addScaledVector(projectile.velocity, deltaScaled / steps)

                if(projectile.mesh.position.y < -0.5)
                    dead = true
                else if(this.game.enemies && this.game.enemies.tryHit(projectile.mesh.position, 1.1, 1))
                    dead = true
            }

            if(dead)
            {
                this.game.scene.remove(projectile.mesh)
                this.shooting.projectiles.splice(i, 1)
            }
        }

        if(!this.active)
            return

        // Sync position from physics
        const translation = this.body.translation()
        this.position.set(translation.x, translation.y - 0.7, translation.z)

        this.group.position.copy(this.position)
        this.group.rotation.y = this.rotationY

        // Fell off the world
        if(this.position.y < -12 && !this.health.dead)
            this.die()

        // Health regen
        if(!this.health.dead && this.health.current < this.health.max && elapsed - this.health.lastHitAt > this.health.regenDelay)
        {
            this.health.current = Math.min(this.health.max, this.health.current + this.health.regenRate * delta)
            this.updateHealthHud()
        }

        // Walk animation
        const linvel = this.body.linvel()
        const groundSpeed = Math.hypot(linvel.x, linvel.z)

        if(groundSpeed > 0.5)
        {
            this.walkPhase += delta * groundSpeed * 2.5
            const swing = Math.sin(this.walkPhase) * 0.6
            this.legLeft.rotation.x = swing
            this.legRight.rotation.x = -swing
            this.armLeft.rotation.x = -swing * 0.7
            this.armRight.rotation.x = swing * 0.7
        }
        else
        {
            this.legLeft.rotation.x = 0
            this.legRight.rotation.x = 0
            this.armLeft.rotation.x = 0
            this.armRight.rotation.x = 0
        }

        // Drive the view and tracks focus (Player skips these while we're on foot)
        this.game.view.focusPoint.trackedPosition.set(this.position.x, this.position.y + 0.8, this.position.z)
        this.game.view.speedLines.strength = 0
        this.game.tracks.focusPoint.set(this.position.x, this.position.z)
        this.game.inputs.nipple.setCoordinates(this.position.x, this.position.y, this.position.z, this.rotationY)
    }

    updateCamera()
    {
        if(this.cameraMode !== Character.CAMERA_FIRST_PERSON)
            return

        const camera = this.game.view.camera

        if(camera.fov !== this.fp.fov)
        {
            camera.fov = this.fp.fov
            camera.updateProjectionMatrix()
        }

        if(this.active)
        {
            camera.position.set(this.position.x, this.position.y + 1.6, this.position.z)
            camera.quaternion.setFromEuler(new THREE.Euler(this.fp.pitch, this.fp.yaw + Math.PI, 0, 'YXZ'))
        }
        else
        {
            // Hood cam while driving
            const vehiclePosition = this.game.physicalVehicle.position
            const forward = this.game.physicalVehicle.forward
            const yaw = Math.atan2(forward.x, forward.z)

            camera.position.set(
                vehiclePosition.x + forward.x * 0.6,
                vehiclePosition.y + 1.7,
                vehiclePosition.z + forward.z * 0.6
            )
            camera.quaternion.setFromEuler(new THREE.Euler(-0.06, yaw + Math.PI, 0, 'YXZ'))
        }
    }
}
