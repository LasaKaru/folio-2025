import { Howler } from 'howler'
import { Game } from './Game.js'

export class Options
{
    constructor()
    {
        this.game = Game.getInstance()
        this.element = this.game.menu.items.get('options').contentElement

        this.setSound()
        this.setQuality()
        this.setRespawn()
        this.setReset()
        this.setCitizens()
        this.setTraffic()
        this.setTheme()
        this.setMissionHud()
        this.setVolume()
        this.setSensitivity()
        this.setDifficulty()
        this.setFullReset()
        this.setRenderer()
        this.setServer()
    }

    setVolume()
    {
        const element = this.element.querySelector('.js-volume-slider')
        const saved = parseFloat(localStorage.getItem('circuitCity.volume') ?? '1')

        element.value = saved
        Howler.volume(saved)

        element.addEventListener('input', () =>
        {
            const value = parseFloat(element.value)
            Howler.volume(value)
            localStorage.setItem('circuitCity.volume', value)
        })
    }

    setSensitivity()
    {
        const element = this.element.querySelector('.js-sensitivity-slider')
        const saved = parseFloat(localStorage.getItem('circuitCity.sensitivity') ?? '1')

        element.value = saved

        element.addEventListener('input', () =>
        {
            const value = parseFloat(element.value)
            localStorage.setItem('circuitCity.sensitivity', value)

            if(this.game.character)
                this.game.character.mouseSensitivity = value
        })
    }

    setDifficulty()
    {
        const element = this.element.querySelector('.js-difficulty-toggle')
        const text = element.querySelector('span')
        const order = [ 'easy', 'normal', 'hard' ]
        const labels = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

        const update = () =>
        {
            const current = this.game.enemies?.difficulty ?? localStorage.getItem('circuitCity.difficulty') ?? 'normal'
            text.textContent = labels[current]
        }

        update()

        element.addEventListener('click', () =>
        {
            const current = this.game.enemies?.difficulty ?? 'normal'
            const next = order[(order.indexOf(current) + 1) % order.length]

            if(this.game.enemies)
                this.game.enemies.applyDifficulty(next)
            else
                localStorage.setItem('circuitCity.difficulty', next)

            update()
        })
    }

    setFullReset()
    {
        const element = this.element.querySelector('.js-full-reset')

        element.addEventListener('click', () =>
        {
            if(!window.confirm('Wipe all Circuit City progress? Credits, garage upgrades, story progress and achievements will be lost. This cannot be undone.'))
                return

            const keysToRemove = []
            for(let i = 0; i < localStorage.length; i++)
            {
                const key = localStorage.key(i)
                if(key.startsWith('circuitCity.') || key === 'achievements' || key === 'achievementsTimeStart' || key === 'achievementsTimeEnd' || key === 'achievementsReward' || key === 'distanceDriven' || key === 'timePlayed')
                    keysToRemove.push(key)
            }

            for(const key of keysToRemove)
                localStorage.removeItem(key)

            window.location.reload()
        })
    }

    setCitizens()
    {
        const element = this.element.querySelector('.js-citizens-toggle')
        const text = element.querySelector('span')

        const update = () =>
        {
            const enabled = localStorage.getItem('circuitCity.citizens') !== 'off'
            text.textContent = enabled ? 'On' : 'Off'
        }

        update()

        element.addEventListener('click', () =>
        {
            const enabled = localStorage.getItem('circuitCity.citizens') !== 'off'

            if(this.game.world.citizens)
                this.game.world.citizens.setEnabled(!enabled)
            else
                localStorage.setItem('circuitCity.citizens', enabled ? 'off' : 'on')

            update()
        })
    }

    setTraffic()
    {
        const element = this.element.querySelector('.js-traffic-toggle')
        const text = element.querySelector('span')

        const update = () =>
        {
            const enabled = localStorage.getItem('circuitCity.traffic') !== 'off'
            text.textContent = enabled ? 'On' : 'Off'
        }

        update()

        element.addEventListener('click', () =>
        {
            const enabled = localStorage.getItem('circuitCity.traffic') !== 'off'

            if(this.game.traffic)
                this.game.traffic.setEnabled(!enabled)
            else
                localStorage.setItem('circuitCity.traffic', enabled ? 'off' : 'on')

            update()
        })
    }

    setTheme()
    {
        const element = this.element.querySelector('.js-theme-toggle')
        const text = element.querySelector('span')

        const update = () =>
        {
            text.textContent = this.game.dayCycles.theme === 'classic' ? 'Classic' : 'Neon'
        }

        update()

        element.addEventListener('click', () =>
        {
            this.game.dayCycles.applyTheme(this.game.dayCycles.theme === 'classic' ? 'neon' : 'classic')
            update()
        })
    }

    setMissionHud()
    {
        const element = this.element.querySelector('.js-hud-toggle')
        const text = element.querySelector('span')

        const update = () =>
        {
            const visible = localStorage.getItem('circuitCity.hud') !== 'off'
            text.textContent = visible ? 'On' : 'Off'
        }

        update()

        element.addEventListener('click', () =>
        {
            const visible = localStorage.getItem('circuitCity.hud') !== 'off'

            if(this.game.missions)
                this.game.missions.setHudVisible(!visible)
            else
                localStorage.setItem('circuitCity.hud', visible ? 'off' : 'on')

            update()
        })
    }

    setSound()
    {
        const element = this.element.querySelector('.js-audio-toggle')

        element.addEventListener('click', this.game.audio.mute.toggle)
    }

    setQuality()
    {
        const element = this.element.querySelector('.js-quality-toggle')
        const text = element.querySelector('span')
        text.textContent = this.game.quality.level === 0 ? 'High' : 'Low'

        element.addEventListener('click', () =>
        {
            this.game.quality.changeLevel(this.game.quality.level === 0 ? 1 : 0)
        })

        this.game.quality.events.on('change', () =>
        {
            text.textContent = this.game.quality.level === 0 ? 'High' : 'Low'
        })
    }

    setRespawn()
    {
        const element = this.element.querySelector('.js-respawn')

        element.addEventListener('click', () =>
        {
            this.game.player.respawn()
            this.game.menu.close()
        })
    }

    setReset()
    {
        const element = this.element.querySelector('.js-reset')

        element.addEventListener('click', () =>
        {
            this.game.reset()
            this.game.menu.close()
        })
    }

    setRenderer()
    {        
        if(this.game.rendering.renderer.backend.isWebGLBackend)
        {
            const element = this.element.querySelector('.js-renderer')
            element.classList.remove('is-success')
            element.classList.add('is-danger')

            const text = element.querySelector('span')
            text.textContent = 'WebGL'

            const tooltip = element.querySelector('.js-tooltip')
            tooltip.innerHTML = /* html */`Your browser is <strong>not compatible</strong> with WebGPU resulting in performance loss`
        }
    }

    setServer()
    {
        const element = this.element.querySelector('.js-server')
        const text = element.querySelector('span')
        const tooltip = element.querySelector('.js-tooltip')
        
        const update = (connected) =>
        {
            if(connected)
            {
                element.classList.add('is-success')
                element.classList.remove('is-danger')
                
                text.textContent = 'Online'

                tooltip.innerHTML = /* html */`Enjoy the <strong>multiplayer</strong> features`
            }
            else
            {
                element.classList.remove('is-success')
                element.classList.add('is-danger')
                text.textContent = 'Offline'

                tooltip.innerHTML = /* html */`Should be back soon`
            }
        }

        update(this.game.server.connected)

        this.game.server.events.on('connected', () =>
        {
            update(true)
        })
        this.game.server.events.on('disconnected', () =>
        {
            update(false)
        })
    }
}