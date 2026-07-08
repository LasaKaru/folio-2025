import { Game } from './Game.js'

// Tracks a local "campaign completion time" leaderboard. The clock starts
// the first time the game is ever loaded and stops the moment the final
// story chapter is cleared -- top 5 runs are kept in localStorage.
export class Leaderboard
{
    constructor()
    {
        this.game = Game.getInstance()

        if(!localStorage.getItem('circuitCity.startTime'))
            localStorage.setItem('circuitCity.startTime', `${Date.now()}`)

        this.load()
        this.setHud()
    }

    setHud()
    {
        this.hud = {}
        this.hud.list = this.game.domElement.querySelector('.js-leaderboard-list')
        this.updateHud()
    }

    updateHud()
    {
        if(!this.hud.list)
            return

        if(this.entries.length === 0)
        {
            this.hud.list.innerHTML = '<li class="text-faded">No runs yet — beat the final boss to set a time.</li>'
            return
        }

        this.hud.list.innerHTML = this.entries
            .map((entry) => `<li>${this.formatTime(entry.time)} — ${entry.date}</li>`)
            .join('')
    }

    load()
    {
        try { this.entries = JSON.parse(localStorage.getItem('circuitCity.leaderboard')) ?? [] }
        catch { this.entries = [] }
    }

    save()
    {
        localStorage.setItem('circuitCity.leaderboard', JSON.stringify(this.entries))
    }

    getEntries()
    {
        return this.entries
    }

    formatTime(ms)
    {
        const totalSeconds = Math.floor(ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    recordVictory()
    {
        const startTime = parseInt(localStorage.getItem('circuitCity.startTime')) || Date.now()
        const elapsed = Date.now() - startTime

        this.entries.push({ time: elapsed, date: new Date().toLocaleDateString() })
        this.entries.sort((a, b) => a.time - b.time)
        this.entries = this.entries.slice(0, 5)
        this.save()
        this.updateHud()

        this.game.achievements.setProgress('victory', 1)

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🏁 VICTORY!</div>
                </div>
                <div class="bottom">
                    <div class="description">Circuit City is yours -- finished in ${this.formatTime(elapsed)}. Check the leaderboard in the menu.</div>
                </div>
            `,
            'mission',
            10,
            null,
            'victory'
        )

        return elapsed
    }
}
