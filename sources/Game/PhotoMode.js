import { Game } from './Game.js'
import { View } from './View.js'

// Free camera + color filters for screenshots. Reuses View's existing
// MODE_FREE (the camera-controls-driven free camera already wired up for
// debug use) rather than building a second camera rig.
//
// The world keeps simulating while this is active -- enemies, traffic and
// pedestrians don't freeze, only the player's own input is suppressed (see
// the 'photo' input filter below). This is a spectator-style camera, not a
// full pause; ESC's real pause (Pause.js) already covers "freeze everything".
export class PhotoMode
{
    static FILTERS = [
        { name: 'Normal', css: 'none' },
        { name: 'Neon', css: 'saturate(1.6) contrast(1.15) hue-rotate(-8deg)' },
        { name: 'Noir', css: 'grayscale(1) contrast(1.3) brightness(0.95)' },
        { name: 'Sepia', css: 'sepia(0.7) contrast(1.05)' },
        { name: 'Dusk', css: 'saturate(1.3) hue-rotate(18deg) brightness(0.92)' },
    ]

    // Actions whose held/latched state should be cleared on entry, so a
    // truck/character already moving when photo mode opens doesn't keep
    // coasting on a stale "key still down" state until the key is released.
    static SUPPRESSED_ON_ENTRY = [ 'forward', 'backward', 'left', 'right', 'boost', 'brake', 'shoot' ]

    constructor()
    {
        this.game = Game.getInstance()
        this.active = false
        this.filterIndex = 0
        this.previousFilters = [ 'wandering' ]

        this.setHud()
        this.setToggle()
    }

    setHud()
    {
        this.hud = {}
        this.hud.hint = this.game.domElement.querySelector('.js-photo-mode-hint')
        this.hud.filterName = this.game.domElement.querySelector('.js-photo-mode-filter-name')
    }

    setToggle()
    {
        // 'photoModeToggle' is a single action for both entering and
        // exiting, deliberately -- two separate actions sharing the same K
        // key (one gated on 'wandering', one on 'photo') created a race:
        // Inputs.start() computes the list of matching actions once, then
        // entering photo mode flips the filter mid-loop, so the *second*
        // matching action would see the new filter and immediately fire
        // too, undoing the first. categories: [] (matching View.js's debug
        // free-cam toggle) makes it always fire; the 'wandering' check
        // happens by hand instead of through the filter system.
        this.game.inputs.addActions([
            { name: 'photoModeToggle', categories: [], keys: [ 'Keyboard.KeyK' ] },
            { name: 'photoModeExit', categories: [ 'photo' ], keys: [ 'Keyboard.Escape' ] },
            { name: 'photoModeFilter', categories: [ 'photo' ], keys: [ 'Keyboard.KeyF' ] },
        ])

        this.game.inputs.events.on('photoModeToggle', (action) =>
        {
            if(!action.active)
                return

            if(this.active)
                this.exit()
            else if(this.game.inputs.filters.has('wandering'))
                this.enter()
        })

        this.game.inputs.events.on('photoModeExit', (action) =>
        {
            if(action.active)
                this.exit()
        })

        this.game.inputs.events.on('photoModeFilter', (action) =>
        {
            if(action.active)
                this.cycleFilter()
        })
    }

    enter()
    {
        if(this.active)
            return

        this.active = true
        this.previousFilters = [ ...this.game.inputs.filters ]

        // Close whatever modal/menu is open so it doesn't sit over the shot
        // -- checkCategory only lets photoModeToggle fire from 'wandering',
        // but that filter can still be set while a modal is fading out.
        this.game.modals?.close()
        this.game.menu?.close()

        for(const name of PhotoMode.SUPPRESSED_ON_ENTRY)
        {
            const action = this.game.inputs.actions.get(name)
            if(action)
            {
                action.active = false
                action.value = 0
                action.activeKeys.clear()
            }
        }

        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('photo')

        this.game.view.setMode(View.MODE_FREE)
        document.documentElement.classList.add('is-photo-mode')
        this.applyFilter()
    }

    exit()
    {
        if(!this.active)
            return

        this.active = false

        this.game.inputs.filters.clear()
        for(const filter of this.previousFilters)
            this.game.inputs.filters.add(filter)

        this.game.view.setMode(View.MODE_DEFAULT)
        document.documentElement.classList.remove('is-photo-mode')
        this.game.canvasElement.style.filter = 'none'
    }

    cycleFilter()
    {
        this.filterIndex = (this.filterIndex + 1) % PhotoMode.FILTERS.length
        this.applyFilter()
    }

    applyFilter()
    {
        const filter = PhotoMode.FILTERS[this.filterIndex]
        this.game.canvasElement.style.filter = filter.css

        if(this.hud.filterName)
            this.hud.filterName.textContent = filter.name
    }
}
