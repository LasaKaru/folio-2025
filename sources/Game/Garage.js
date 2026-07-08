import { Game } from './Game.js'
import {
    truckUpgrades,
    weaponUpgrades,
    heroUpgrades,
    weaponUnlocks,
    truckPaints,
    heroOutfits,
    weaponSkins,
    getUpgradeCost,
} from '../data/upgrades.js'

// The Garage: spend credits earned from missions/story/survival on
// truck upgrades, weapon unlocks and cosmetics. Everything here reads
// existing base stats once at startup and reapplies multipliers on
// top, so it never has to know "the" base value is elsewhere.
export class Garage
{
    constructor()
    {
        this.game = Game.getInstance()

        // Base stats captured before any upgrade is applied
        this.base = {
            engine: this.game.physicalVehicle.engineForceAmplitude,
            boost: this.game.physicalVehicle.boostMultiplier,
            handling: this.game.physicalVehicle.steeringAmplitude,
        }

        this.load()
        this.setHud()
        this.applyAll()
    }

    load()
    {
        let saved = {}
        try { saved = JSON.parse(localStorage.getItem('neonHavoc.garage')) ?? {} }
        catch { saved = {} }

        this.state = {
            truck: { engine: 0, boost: 0, handling: 0, ...saved.truck },
            weapon: { damage: 0, rate: 0, ...saved.weapon },
            hero: { health: 0, sprint: 0, ...saved.hero },
            unlocks: { shotgun: false, rocket: false, melee: false, tripleShot: false, ...saved.unlocks },
            ownedPaints: saved.ownedPaints ?? [],
            ownedOutfits: saved.ownedOutfits ?? [ 'default' ],
            ownedSkins: saved.ownedSkins ?? [ 'default' ],
            equippedPaint: saved.equippedPaint ?? null,
            equippedOutfit: saved.equippedOutfit ?? 'default',
            equippedSkin: saved.equippedSkin ?? 'default',
        }
    }

    save()
    {
        localStorage.setItem('neonHavoc.garage', JSON.stringify(this.state))
    }

    setHud()
    {
        this.hud = {}
        this.hud.trigger = this.game.domElement.querySelector('.js-garage-trigger')
        this.hud.modal = this.game.modals.items.get('garage')
        this.hud.content = this.hud.modal.element.querySelector('.js-garage-content')

        this.hud.trigger.addEventListener('click', () =>
        {
            this.render()
            this.game.modals.open('garage')
        })

        this.hud.modal.events.on('open', () =>
        {
            this.render()
        })
    }

    // --- Cost helpers ---

    upgradeCost(definition, level)
    {
        return getUpgradeCost(definition, level)
    }

    canAfford(cost)
    {
        return this.game.missions.cash >= cost
    }

    spend(cost)
    {
        this.game.missions.cash -= cost
        this.game.missions.save()
        this.game.missions.updateCashHud()
    }

    // --- Purchases ---

    purchaseUpgrade(category, key, definitions)
    {
        const definition = definitions[key]
        const level = this.state[category][key]

        if(level >= definition.max)
            return false

        const cost = this.upgradeCost(definition, level)

        if(!this.canAfford(cost))
            return false

        this.spend(cost)
        this.state[category][key] = level + 1
        this.save()
        this.applyAll()
        this.game.achievements.setProgress('garage', 1)

        return true
    }

    purchaseUnlock(key)
    {
        if(this.state.unlocks[key])
            return false

        const definition = weaponUnlocks[key]
        if(!this.canAfford(definition.cost))
            return false

        this.spend(definition.cost)
        this.state.unlocks[key] = true
        this.save()

        if(key === 'tripleShot')
        {
            this.game.character.weapons.hasTripleShot = true
        }
        else
        {
            this.game.character.unlockWeapon(key)
        }

        this.game.character.updateWeaponHud()

        return true
    }

    purchaseCosmetic(kind, key)
    {
        const table = kind === 'paint' ? truckPaints : kind === 'outfit' ? heroOutfits : weaponSkins
        const ownedKey = kind === 'paint' ? 'ownedPaints' : kind === 'outfit' ? 'ownedOutfits' : 'ownedSkins'
        const definition = table[key]

        if(this.state[ownedKey].includes(key))
            return false

        if(!this.canAfford(definition.cost))
            return false

        if(definition.cost > 0)
            this.spend(definition.cost)

        this.state[ownedKey].push(key)
        this.save()

        return true
    }

    equipCosmetic(kind, key)
    {
        if(kind === 'paint')
        {
            if(!this.state.ownedPaints.includes(key))
                return false

            this.state.equippedPaint = key
            this.game.world.visualVehicle.paints.equip(key)
        }
        else if(kind === 'outfit')
        {
            if(!this.state.ownedOutfits.includes(key))
                return false

            this.state.equippedOutfit = key
            this.game.character.setOutfit(key)
        }
        else if(kind === 'skin')
        {
            if(!this.state.ownedSkins.includes(key))
                return false

            this.state.equippedSkin = key
            this.game.character.setWeaponSkin(key)
        }

        this.save()
        return true
    }

    // --- Apply to live systems ---

    applyAll()
    {
        const vehicle = this.game.physicalVehicle
        const character = this.game.character

        vehicle.engineForceAmplitude = this.base.engine * (1 + this.state.truck.engine * truckUpgrades.engine.step)
        vehicle.boostMultiplier = this.base.boost * (1 + this.state.truck.boost * truckUpgrades.boost.step)
        vehicle.steeringAmplitude = this.base.handling * (1 + this.state.truck.handling * truckUpgrades.handling.step)

        character.damageMultiplier = 1 + this.state.weapon.damage * weaponUpgrades.damage.step
        character.rateBonus = this.state.weapon.rate * weaponUpgrades.rate.step

        character.health.max = 100 + this.state.hero.health * heroUpgrades.health.step
        character.health.current = Math.min(character.health.current || character.health.max, character.health.max)
        character.sprintSpeed = 8 + this.state.hero.sprint * heroUpgrades.sprint.step

        character.weapons.owned = [ 'blaster' ]
        for(const key of [ 'shotgun', 'rocket', 'melee' ])
        {
            if(this.state.unlocks[key])
                character.weapons.owned.push(key)
        }
        character.weapons.hasTripleShot = this.state.unlocks.tripleShot

        if(this.state.equippedPaint)
            this.game.world.visualVehicle.paints.equip(this.state.equippedPaint)

        character.setOutfit(this.state.equippedOutfit)
        character.setWeaponSkin(this.state.equippedSkin)

        character.updateHealthHud()
        character.updateWeaponHud()
    }

    // --- UI rendering (built in JS, no static markup needed) ---

    row(title, description, valueLabel, buttonLabel, onBuy, disabled)
    {
        const row = document.createElement('div')
        row.classList.add('garage-row')
        row.innerHTML = /* html */`
            <div class="info">
                <div class="title">${title}</div>
                <div class="description">${description}</div>
            </div>
            <div class="value">${valueLabel}</div>
            <button class="button is-small${disabled ? ' is-disabled' : ''}">${buttonLabel}</button>
        `

        if(!disabled)
        {
            row.querySelector('button').addEventListener('click', () =>
            {
                if(onBuy())
                    this.render()
            })
        }

        return row
    }

    section(title)
    {
        const section = document.createElement('div')
        section.classList.add('garage-section')
        const heading = document.createElement('div')
        heading.classList.add('garage-section-title')
        heading.textContent = title
        section.append(heading)
        return section
    }

    render()
    {
        if(!this.hud.content)
            return

        this.hud.content.innerHTML = ''

        const cashBanner = document.createElement('div')
        cashBanner.classList.add('garage-cash')
        cashBanner.textContent = `${this.game.missions.cash.toLocaleString('en-US')} CR available`
        this.hud.content.append(cashBanner)

        // Truck upgrades
        const truckSection = this.section('🚚 Truck')
        for(const key in truckUpgrades)
        {
            const definition = truckUpgrades[key]
            const level = this.state.truck[key]
            const maxed = level >= definition.max
            const cost = maxed ? null : this.upgradeCost(definition, level)

            truckSection.append(this.row(
                definition.name,
                definition.description,
                `Lv ${level}/${definition.max}`,
                maxed ? 'MAX' : `${cost} CR`,
                () => this.purchaseUpgrade('truck', key, truckUpgrades),
                maxed || !this.canAfford(cost)
            ))
        }
        this.hud.content.append(truckSection)

        // Weapon upgrades
        const weaponSection = this.section('🔫 Weapon upgrades')
        for(const key in weaponUpgrades)
        {
            const definition = weaponUpgrades[key]
            const level = this.state.weapon[key]
            const maxed = level >= definition.max
            const cost = maxed ? null : this.upgradeCost(definition, level)

            weaponSection.append(this.row(
                definition.name,
                definition.description,
                `Lv ${level}/${definition.max}`,
                maxed ? 'MAX' : `${cost} CR`,
                () => this.purchaseUpgrade('weapon', key, weaponUpgrades),
                maxed || !this.canAfford(cost)
            ))
        }
        this.hud.content.append(weaponSection)

        // Hero upgrades
        const heroSection = this.section('🦸 Hero')
        for(const key in heroUpgrades)
        {
            const definition = heroUpgrades[key]
            const level = this.state.hero[key]
            const maxed = level >= definition.max
            const cost = maxed ? null : this.upgradeCost(definition, level)

            heroSection.append(this.row(
                definition.name,
                definition.description,
                `Lv ${level}/${definition.max}`,
                maxed ? 'MAX' : `${cost} CR`,
                () => this.purchaseUpgrade('hero', key, heroUpgrades),
                maxed || !this.canAfford(cost)
            ))
        }
        this.hud.content.append(heroSection)

        // Weapon unlocks
        const unlocksSection = this.section('🧰 New weapons')
        for(const key in weaponUnlocks)
        {
            const definition = weaponUnlocks[key]
            const owned = this.state.unlocks[key]

            unlocksSection.append(this.row(
                definition.name,
                definition.description,
                owned ? 'OWNED' : '',
                owned ? '✓' : `${definition.cost} CR`,
                () => this.purchaseUnlock(key),
                owned || !this.canAfford(definition.cost)
            ))
        }
        this.hud.content.append(unlocksSection)

        // Cosmetics: paints
        const paintsSection = this.section('🎨 Truck paint')
        for(const key in truckPaints)
        {
            paintsSection.append(this.cosmeticRow('paint', key, truckPaints[key]))
        }
        this.hud.content.append(paintsSection)

        // Cosmetics: outfits
        const outfitsSection = this.section('🧥 Hero outfit')
        for(const key in heroOutfits)
        {
            outfitsSection.append(this.cosmeticRow('outfit', key, heroOutfits[key]))
        }
        this.hud.content.append(outfitsSection)

        // Cosmetics: weapon skins
        const skinsSection = this.section('✨ Weapon skin')
        for(const key in weaponSkins)
        {
            skinsSection.append(this.cosmeticRow('skin', key, weaponSkins[key]))
        }
        this.hud.content.append(skinsSection)
    }

    cosmeticRow(kind, key, definition)
    {
        const ownedKey = kind === 'paint' ? 'ownedPaints' : kind === 'outfit' ? 'ownedOutfits' : 'ownedSkins'
        const equippedKey = kind === 'paint' ? 'equippedPaint' : kind === 'outfit' ? 'equippedOutfit' : 'equippedSkin'
        const owned = this.state[ownedKey].includes(key)
        const equipped = this.state[equippedKey] === key

        let valueLabel = ''
        let buttonLabel = ''
        let action = null
        let disabled = false

        if(equipped)
        {
            valueLabel = 'EQUIPPED'
            buttonLabel = '✓'
            disabled = true
        }
        else if(owned)
        {
            valueLabel = 'OWNED'
            buttonLabel = 'Equip'
            action = () => this.equipCosmetic(kind, key)
        }
        else
        {
            valueLabel = ''
            buttonLabel = `${definition.cost} CR`
            action = () => this.purchaseCosmetic(kind, key) && this.equipCosmetic(kind, key)
            disabled = !this.canAfford(definition.cost)
        }

        return this.row(definition.name, '', valueLabel, buttonLabel, action ?? (() => false), disabled)
    }
}
