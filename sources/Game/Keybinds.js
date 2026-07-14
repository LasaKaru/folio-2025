import { Game } from './Game.js'

// Settings-driven key rebinding. Only the single-keyboard-key actions are
// rebindable (movement/boost/brake keep their fixed WASD+arrows+gamepad
// combo -- remapping those well needs per-slot UI this game doesn't have).
// Rebinding only ever replaces the *keyboard* entries in an action's `keys`
// array; any Gamepad.* entries on the same action are left alone.
const REBINDABLE = [
    { name: 'vehicleToggle', label: 'Enter / exit vehicle' },
    { name: 'cameraMode', label: 'Toggle camera' },
    { name: 'shoot', label: 'Shoot' },
    { name: 'weaponSwitch', label: 'Switch weapon' },
    { name: 'garage', label: 'Open Garage' },
    { name: 'minimapToggle', label: 'Toggle minimap' },
    { name: 'partnerToggle', label: 'Summon / bench partner' },
    { name: 'whisper', label: 'Post a whisper' },
    { name: 'respawn', label: "I'm stuck (respawn)" },
    { name: 'photoModeToggle', label: 'Photo mode' },
]

const KEY_LABELS = {
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: 'SHIFT',
    ShiftRight: 'SHIFT',
    ControlLeft: 'CTRL',
    ControlRight: 'CTRL',
}

export class Keybinds
{
    constructor()
    {
        this.game = Game.getInstance()
        this.overrides = this.load()
        this.defaults = this.snapshotDefaults()
        this.capturingName = null

        this.applyAll()
        this.setHud()

        // Some rebindable actions (e.g. 'whisper') are registered later, as
        // part of the staged world-loading sequence -- pick up their real
        // default keys (and reapply any pending override) once they exist.
        this.game.inputs.events.on('actionsAdded', (actions) =>
        {
            let changed = false

            for(const { name } of actions)
            {
                if(REBINDABLE.some((entry) => entry.name === name))
                {
                    const action = this.game.inputs.actions.get(name)
                    this.defaults[name] = action ? [ ...action.keys ] : []
                    this.apply(name)
                    changed = true
                }
            }

            if(changed)
                this.renderRows?.()
        })
    }

    load()
    {
        try { return JSON.parse(localStorage.getItem('circuitCity.keybinds')) ?? {} }
        catch { return {} }
    }

    save()
    {
        localStorage.setItem('circuitCity.keybinds', JSON.stringify(this.overrides))
    }

    snapshotDefaults()
    {
        const defaults = {}
        for(const { name } of REBINDABLE)
        {
            const action = this.game.inputs.actions.get(name)
            defaults[name] = action ? [ ...action.keys ] : []
        }
        return defaults
    }

    keyLabel(code)
    {
        if(!code)
            return '?'
        if(code.startsWith('Key'))
            return code.slice(3)
        if(code.startsWith('Digit'))
            return code.slice(5)
        return KEY_LABELS[code] ?? code.toUpperCase()
    }

    currentCode(name)
    {
        if(this.overrides[name])
            return this.overrides[name]

        const defaultKey = (this.defaults[name] ?? []).find((key) => key.startsWith('Keyboard.'))
        return defaultKey ? defaultKey.slice('Keyboard.'.length) : null
    }

    // Is this physical key already used by any action (rebindable or not),
    // other than the one currently being rebound?
    isKeyTaken(code, excludingName)
    {
        for(const [ name, action ] of this.game.inputs.actions)
        {
            if(name === excludingName)
                continue

            if(action.keys.includes(`Keyboard.${code}`))
                return true
        }
        return false
    }

    apply(name)
    {
        const action = this.game.inputs.actions.get(name)
        if(!action)
            return

        const defaultKeys = this.defaults[name] ?? action.keys
        const code = this.overrides[name]

        if(!code)
        {
            action.keys = [ ...defaultKeys ]
            return
        }

        const nonKeyboard = defaultKeys.filter((key) => !key.startsWith('Keyboard.'))
        action.keys = [ `Keyboard.${code}`, ...nonKeyboard ]
    }

    applyAll()
    {
        for(const { name } of REBINDABLE)
            this.apply(name)
    }

    rebind(name, code)
    {
        if(this.isKeyTaken(code, name))
            return false

        this.overrides[name] = code
        this.save()
        this.apply(name)

        return true
    }

    resetToDefault(name)
    {
        delete this.overrides[name]
        this.save()
        this.apply(name)
    }

    resetAll()
    {
        this.overrides = {}
        this.save()
        this.applyAll()
    }

    setHud()
    {
        this.tbody = this.game.menu.items.get('options').contentElement.querySelector('table.options tbody')
        if(!this.tbody)
            return

        // A single hidden input used to capture the next keydown -- the
        // global Keyboard.js listener already ignores keydown while
        // document.activeElement is an <input> (except Escape, which we
        // stop from propagating below), so focusing it is enough to keep
        // driving/shooting from firing while we're listening for a key.
        this.captureInput = document.createElement('input')
        this.captureInput.type = 'text'
        this.captureInput.readOnly = true
        this.captureInput.classList.add('keybind-capture')
        this.captureInput.addEventListener('keydown', (event) =>
        {
            event.preventDefault()
            event.stopPropagation()

            if(!this.capturingName)
                return

            const name = this.capturingName
            this.capturingName = null
            this.captureInput.blur()

            if(event.code !== 'Escape')
                this.rebind(name, event.code)

            this.renderRows()
        })
        this.captureInput.addEventListener('blur', () =>
        {
            if(this.capturingName)
            {
                this.capturingName = null
                this.renderRows()
            }
        })
        document.body.append(this.captureInput)

        const heading = document.createElement('tr')
        heading.innerHTML = /* html */`<td colspan="2"><div class="title keybinds-title">Key bindings</div></td>`
        this.tbody.append(heading)

        this.rowsContainer = document.createElement('tr')
        this.rowsContainer.innerHTML = /* html */`<td colspan="2"></td>`
        this.tbody.append(this.rowsContainer)

        const resetRow = document.createElement('tr')
        resetRow.innerHTML = /* html */`
            <td>Reset all key bindings</td>
            <td><button class="js-keybinds-reset button is-small has-tooltip"><div class="tooltip">Restores every key above to its default</div>Reset</button></td>
        `
        resetRow.querySelector('button').addEventListener('click', () =>
        {
            this.resetAll()
            this.renderRows()
        })
        this.tbody.append(resetRow)

        this.renderRows()
    }

    renderRows()
    {
        const container = this.rowsContainer.querySelector('td')
        container.innerHTML = ''

        for(const { name, label } of REBINDABLE)
        {
            const row = document.createElement('div')
            row.classList.add('garage-row', 'keybind-row')

            const capturing = this.capturingName === name
            const keyLabel = capturing ? 'Press a key…' : this.keyLabel(this.currentCode(name))

            row.innerHTML = /* html */`
                <div class="info">
                    <div class="title">${label}</div>
                </div>
                <button class="button is-small keybind-key${capturing ? ' is-listening' : ''}">${keyLabel}</button>
            `

            row.querySelector('button').addEventListener('click', () =>
            {
                this.capturingName = name
                this.renderRows()
                this.captureInput.focus()
            })

            container.append(row)
        }
    }
}
