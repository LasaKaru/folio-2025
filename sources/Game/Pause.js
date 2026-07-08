import { Game } from './Game.js'

// Real pause: freezes the whole simulation (physics, enemies, timers,
// rendering) for as long as the menu is open, instead of letting the
// world keep running behind it. The menu itself already opens on ESC
// (ClosingManager.js) -- this just ties the ticker's pause flag to it.
export class Pause
{
    constructor()
    {
        this.game = Game.getInstance()

        this.game.menu.events.on('open', () =>
        {
            this.game.ticker.paused = true
        })

        this.game.menu.events.on('close', () =>
        {
            this.game.ticker.paused = false
        })
    }
}
