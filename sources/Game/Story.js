import { Game } from './Game.js'
import storyData from '../data/story.js'
import gsap from 'gsap'

// Story campaign: spawns one raider camp per chapter and moves the
// player through the storyline as camps get cleared.
export class Story
{
    constructor()
    {
        this.game = Game.getInstance()

        const saved = parseInt(localStorage.getItem('circuitCity.chapter') ?? '0')
        this.chapterIndex = Number.isNaN(saved) ? 0 : Math.min(saved, storyData.length)
        this.currentCamp = null

        this.hud = {}
        this.hud.storyLine = this.game.domElement.querySelector('.js-story-line')

        // Restore achievements for finished chapters
        for(let i = 0; i < this.chapterIndex; i++)
            this.game.achievements.setProgress('story', storyData[i].id)

        if(this.chapterIndex >= storyData.length)
        {
            this.updateHud(null)
        }
        else
        {
            this.startChapter(this.chapterIndex, false)
        }
    }

    get chapter()
    {
        return storyData[this.chapterIndex]
    }

    startChapter(index, announce = true)
    {
        this.chapterIndex = index
        const chapter = this.chapter

        // Spawn the camp
        this.currentCamp = this.game.enemies.spawnCamp(chapter.camp)

        this.currentCamp.events.on('kill', (killed, total) =>
        {
            this.updateHud(`${killed} / ${total} hostiles down`)
        })

        this.currentCamp.events.on('cleared', () =>
        {
            this.completeChapter()
        })

        this.updateHud(null)

        // Story notification
        const show = () =>
        {
            this.game.notifications.show(
                /* html */`
                    <div class="top">
                        <div class="title">📖 Chapter ${index + 1} — ${chapter.title}</div>
                    </div>
                    <div class="bottom">
                        <div class="description">${chapter.text}</div>
                    </div>
                `,
                'mission',
                10,
                null,
                `story-${chapter.id}`
            )
        }

        if(announce)
            show()
        else
            gsap.delayedCall(12, show)
    }

    completeChapter()
    {
        const chapter = this.chapter

        // Rewards
        this.game.missions.addCash(chapter.reward)
        this.game.achievements.setProgress('story', chapter.id)

        // Persist
        localStorage.setItem('circuitCity.chapter', `${this.chapterIndex + 1}`)

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🏆 ${chapter.title} — cleared</div>
                </div>
                <div class="bottom">
                    <div class="description">+${chapter.reward} CR${this.chapterIndex + 1 < storyData.length ? ' — a new chapter begins…' : ' — you finished the story!'}</div>
                </div>
            `,
            'mission',
            8,
            null,
            `story-clear-${chapter.id}`
        )

        // Clean up the cleared camp after the bodies sink
        const clearedCamp = this.currentCamp
        gsap.delayedCall(5, () =>
        {
            this.game.enemies.removeCamp(clearedCamp)
        })

        // Next chapter
        if(this.chapterIndex + 1 < storyData.length)
        {
            gsap.delayedCall(8, () =>
            {
                this.startChapter(this.chapterIndex + 1)
            })
        }
        else
        {
            this.chapterIndex += 1
            this.currentCamp = null
            this.updateHud(null)
        }
    }

    updateHud(progressText)
    {
        if(!this.hud.storyLine)
            return

        if(this.chapterIndex >= storyData.length)
        {
            this.hud.storyLine.textContent = 'Story complete — the island is yours'
            return
        }

        const chapter = this.chapter
        const base = `Chapter ${this.chapterIndex + 1}/${storyData.length} — ${chapter.title}`
        this.hud.storyLine.textContent = progressText ? `${base}: ${progressText}` : base
    }
}
