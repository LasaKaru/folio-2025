import { Game } from './Game.js'

// The truck's own HP, separate from the hero's. Takes damage from hard
// crashes (sudden deceleration) and from enemies hitting/shooting it while
// the player is driving through. Repairable at the Garage for credits.
export class VehicleHealth
{
    constructor()
    {
        this.game = Game.getInstance()

        this.base = 100
        this.max = this.base
        this.current = this.max
        this.lastSpeed = 0
        this.crashThreshold = 16
        this.destroyed = false

        this.setHud()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 12)
    }

    setHud()
    {
        this.hud = {}
        this.hud.bar = this.game.domElement.querySelector('.js-vehicle-health-bar')
        this.updateHud()
    }

    updateHud()
    {
        if(this.hud.bar)
        {
            const ratio = Math.max(0, this.current / this.max)
            this.hud.bar.style.transform = `scaleX(${ratio})`
            this.hud.bar.classList.toggle('is-low', ratio < 0.3)
        }
    }

    damage(amount)
    {
        if(this.destroyed || amount <= 0)
            return

        this.current = Math.max(0, this.current - amount)
        this.updateHud()

        if(this.current <= 0)
            this.destroyVehicle()
    }

    repair(amount = this.max)
    {
        this.current = Math.min(this.max, this.current + amount)
        this.destroyed = false
        this.updateHud()
    }

    // Vehicle classes (Garage.js) give tankier trucks more max HP -- keeps
    // the current/max ratio stable rather than snapping the health bar.
    setMaxMultiplier(multiplier)
    {
        const ratio = this.max > 0 ? this.current / this.max : 1
        this.max = this.base * multiplier
        this.current = this.max * ratio
        this.updateHud()
    }

    destroyVehicle()
    {
        this.destroyed = true

        this.game.player.respawn(null, () =>
        {
            this.repair()
        })
    }

    update()
    {
        if(!this.game.physicalVehicle)
            return

        const speed = this.game.physicalVehicle.xzSpeed
        const drop = this.lastSpeed - speed

        if(drop > this.crashThreshold)
            this.damage((drop - this.crashThreshold) * 1.4)

        this.lastSpeed = speed
    }
}
