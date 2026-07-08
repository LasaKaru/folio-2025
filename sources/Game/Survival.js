import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

// Havoc Nights: endless waves of zombies attack the compound.
// Step into the beacon on the helipad to start; survive as many
// waves as you can. Ends when the hero dies, pays out CR based on
// how far you got, and keeps a local best-wave record.
export class Survival
{
    static STATE_IDLE = 1
    static STATE_ACTIVE = 2

    constructor()
    {
        this.game = Game.getInstance()

        this.state = Survival.STATE_IDLE
        this.center = { x: this.game.world.base.center.x, z: this.game.world.base.center.z }
        this.beaconRadius = 4
        this.wave = 0
        this.kills = 0
        this.camp = null

        this.best = parseInt(localStorage.getItem('circuitCity.survivalBest') ?? '0') || 0

        this.setMaterials()
        this.setBeacon()
        this.setHud()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setMaterials()
    {
        this.material = this.game.materials.createEmissive('survivalBeacon', '#ffd23f', 2.5)
    }

    setBeacon()
    {
        this.beaconGroup = new THREE.Group()
        this.beaconGroup.position.set(this.center.x, 0.5, this.center.z)

        const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.18, 12, 48), this.material)
        ring.rotation.x = - Math.PI * 0.5
        this.beaconGroup.add(ring)
        this.beaconRing = ring

        this.game.scene.add(this.beaconGroup)
    }

    setHud()
    {
        this.hud = {}
        this.hud.panel = this.game.domElement.querySelector('.js-survival-panel')
        this.hud.wave = this.game.domElement.querySelector('.js-survival-wave')
        this.hud.best = this.game.domElement.querySelector('.js-survival-best')
        this.updateBestHud()
    }

    updateBestHud()
    {
        if(this.hud.best)
            this.hud.best.textContent = `Best: wave ${this.best}`
    }

    getPlayerPosition()
    {
        if(this.game.character?.active)
            return this.game.character.position

        return this.game.player.position
    }

    start()
    {
        this.state = Survival.STATE_ACTIVE
        this.wave = 0
        this.kills = 0
        this.beaconGroup.visible = false

        this.hud.panel.classList.remove('is-hidden')

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🌙 Havoc Nights</div>
                </div>
                <div class="bottom">
                    <div class="description">Waves incoming. Survive as long as you can.</div>
                </div>
            `,
            'mission',
            4,
            null,
            'survival-start'
        )

        this.nextWave()
    }

    nextWave()
    {
        this.wave++

        const count = Math.min(3 + this.wave, 14)
        const radius = 12

        this.camp = this.game.enemies.spawnCamp({ center: this.center, count, radius, faction: 'zombie' })

        // Scale HP with wave number
        const hpMultiplier = 1 + (this.wave - 1) * 0.18
        for(const enemy of this.camp.enemies)
            enemy.hp = Math.ceil(enemy.hp * hpMultiplier)

        this.camp.events.on('kill', () =>
        {
            this.kills++
        })

        this.camp.events.on('cleared', () =>
        {
            if(this.state !== Survival.STATE_ACTIVE)
                return

            this.game.enemies.removeCamp(this.camp)

            this.game.notifications.show(
                /* html */`
                    <div class="top">
                        <div class="title">Wave ${this.wave} cleared</div>
                    </div>
                    <div class="bottom">
                        <div class="description">Next wave incoming…</div>
                    </div>
                `,
                'mission',
                3,
                null,
                `survival-wave-${this.wave}`
            )

            this.game.ticker.wait(1, () =>
            {
                setTimeout(() =>
                {
                    if(this.state === Survival.STATE_ACTIVE)
                        this.nextWave()
                }, 3000)
            })
        })

        this.updateHud()
    }

    updateHud()
    {
        if(this.hud.wave)
            this.hud.wave.textContent = `Wave ${this.wave}`
    }

    end()
    {
        if(this.state !== Survival.STATE_ACTIVE)
            return

        this.state = Survival.STATE_IDLE

        if(this.camp)
        {
            this.game.enemies.removeCamp(this.camp)
            this.camp = null
        }

        const reachedWave = this.wave
        const reward = reachedWave * 60 + this.kills * 10
        this.game.missions.addCash(reward)

        if(reachedWave > this.best)
        {
            this.best = reachedWave
            localStorage.setItem('circuitCity.survivalBest', this.best)
        }

        if(this.game.achievements.groups.get('survivalWave') && reachedWave > this.game.achievements.groups.get('survivalWave').progress)
            this.game.achievements.setProgress('survivalWave', reachedWave)

        this.updateBestHud()

        this.hud.panel.classList.add('is-hidden')
        this.beaconGroup.visible = true

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🌙 Havoc Nights over</div>
                </div>
                <div class="bottom">
                    <div class="description">Reached wave ${reachedWave} — +${reward} CR</div>
                </div>
            `,
            'mission',
            6,
            null,
            'survival-end'
        )
    }

    update()
    {
        const elapsed = this.game.ticker.elapsed

        if(this.state === Survival.STATE_IDLE)
        {
            this.beaconRing.rotation.z = elapsed * 0.6
            this.beaconGroup.position.y = 0.5 + Math.sin(elapsed * 2) * 0.1

            const position = this.getPlayerPosition()
            const distance = Math.hypot(position.x - this.center.x, position.z - this.center.z)

            if(distance < this.beaconRadius)
                this.start()
        }
    }
}
