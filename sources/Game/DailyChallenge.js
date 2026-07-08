import { Game } from './Game.js'

// A daily challenge, picked deterministically from the calendar date so
// everyone gets the same one on a given day. Progress is tracked as a
// delta against a baseline snapshot taken the first time that day is seen.
export class DailyChallenge
{
    constructor()
    {
        this.game = Game.getInstance()

        this.reward = 400
        this.today = new Date().toDateString()

        this.types = [
            { label: 'Drive 800m', target: 800, get: () => this.game.player.distanceDriven.value },
            { label: 'Take down 6 hostiles', target: 6, get: () => this.game.achievements.groups.get('kills')?.progress ?? 0 },
            { label: 'Complete 2 missions', target: 2, get: () => this.game.missions.completed.size },
        ]

        this.load()
        this.setHud()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 13)
    }

    hashDate(str)
    {
        let hash = 0
        for(let i = 0; i < str.length; i++)
            hash = (hash * 31 + str.charCodeAt(i)) >>> 0
        return hash
    }

    load()
    {
        this.challenge = this.types[this.hashDate(this.today) % this.types.length]

        if(localStorage.getItem('circuitCity.dailyDate') !== this.today)
        {
            localStorage.setItem('circuitCity.dailyDate', this.today)
            localStorage.setItem('circuitCity.dailyBaseline', `${this.challenge.get()}`)
            localStorage.setItem('circuitCity.dailyDone', 'false')
        }

        this.baseline = parseFloat(localStorage.getItem('circuitCity.dailyBaseline')) || 0
        this.done = localStorage.getItem('circuitCity.dailyDone') === 'true'
    }

    setHud()
    {
        this.hud = {}
        this.hud.label = this.game.domElement.querySelector('.js-daily-challenge-label')
        this.updateHud()
    }

    updateHud()
    {
        if(!this.hud.label)
            return

        if(this.done)
        {
            this.hud.label.textContent = `✅ Daily: ${this.challenge.label} — done!`
            return
        }

        const progress = Math.max(0, this.challenge.get() - this.baseline)
        this.hud.label.textContent = `🎯 Daily: ${this.challenge.label} (${Math.min(progress, this.challenge.target).toFixed(0)}/${this.challenge.target})`
    }

    update()
    {
        if(this.done)
            return

        const progress = this.challenge.get() - this.baseline

        if(progress >= this.challenge.target)
            this.complete()

        this.updateHud()
    }

    complete()
    {
        this.done = true
        localStorage.setItem('circuitCity.dailyDone', 'true')

        this.game.missions.addCash(this.reward)
        this.game.achievements.addProgress('dailyChallenge')

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🎯 Daily challenge complete!</div>
                </div>
                <div class="bottom">
                    <div class="description">+${this.reward} CR — come back tomorrow for a new one.</div>
                </div>
            `,
            'mission',
            6,
            null,
            'daily-challenge-complete'
        )

        this.updateHud()
    }
}
