import { Game } from './Game.js'
import gsap from 'gsap'

// Boss Rush: fight every story boss back-to-back for a big payout.
// Triggered from the HUD trigger button; reuses the same camp/boss data
// the story campaign spawns, just chained one after another.
export class BossMode
{
    constructor()
    {
        this.game = Game.getInstance()

        this.bosses = [
            { title: 'The Havoc King', camp: { center: { x: -52, z: -58 }, count: 5, radius: 7, boss: true } },
            { title: 'Enforcer Commander', camp: { center: { x: 5, z: 0 }, count: 5, radius: 8, boss: true, faction: 'enforcer' } },
        ]

        this.active = false
        this.index = 0
        this.currentCamp = null
        this.reward = 3000

        this.setHud()
    }

    setHud()
    {
        this.trigger = this.game.domElement.querySelector('.js-boss-rush-trigger')
        if(!this.trigger)
            return

        this.trigger.addEventListener('click', () =>
        {
            this.start()
        })
    }

    start()
    {
        if(this.active)
            return

        this.active = true
        this.index = 0

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">👑 Boss Rush</div>
                </div>
                <div class="bottom">
                    <div class="description">Every story boss, back-to-back. Good luck.</div>
                </div>
            `,
            'mission',
            6,
            null,
            'boss-rush-start'
        )

        this.spawnNext()
    }

    spawnNext()
    {
        const boss = this.bosses[this.index]

        this.currentCamp = this.game.enemies.spawnCamp(boss.camp)

        this.currentCamp.events.on('cleared', () =>
        {
            this.onBossCleared(boss)
        })

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">⚔️ Boss ${this.index + 1}/${this.bosses.length}: ${boss.title}</div>
                </div>
            `,
            'mission',
            5,
            null,
            `boss-rush-${this.index}`
        )
    }

    onBossCleared(boss)
    {
        const clearedCamp = this.currentCamp
        gsap.delayedCall(3, () =>
        {
            this.game.enemies.removeCamp(clearedCamp)
        })

        this.index += 1

        if(this.index < this.bosses.length)
        {
            gsap.delayedCall(4, () =>
            {
                this.spawnNext()
            })
        }
        else
        {
            this.finish()
        }
    }

    finish()
    {
        this.active = false
        this.game.missions.addCash(this.reward)
        this.game.achievements.setProgress('bossRush', 1)

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🏆 Boss Rush complete!</div>
                </div>
                <div class="bottom">
                    <div class="description">+${this.reward} CR</div>
                </div>
            `,
            'mission',
            8,
            null,
            'boss-rush-complete'
        )
    }
}
