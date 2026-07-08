import { Game } from './Game.js'

// Real-money cosmetic purchases, via server/store.js (Stripe Checkout).
// Entirely optional -- if VITE_STORE_URL isn't set, premium rows in the
// Garage still render but checkout() just explains that the store isn't
// configured, exactly like Multiplayer.js degrades to "Offline" without
// VITE_SERVER_URL.
export class Store
{
    constructor()
    {
        this.game = Game.getInstance()
        this.baseUrl = import.meta.env.VITE_STORE_URL

        this.playerId = this.loadPlayerId()
        this.entitlements = this.loadEntitlements()
        this.grantOwned()

        this.consumeReturnParams()

        if(this.baseUrl)
            this.refresh()
    }

    loadPlayerId()
    {
        let id = localStorage.getItem('circuitCity.playerId')

        if(!id)
        {
            id = crypto.randomUUID()
            localStorage.setItem('circuitCity.playerId', id)
        }

        return id
    }

    loadEntitlements()
    {
        try { return JSON.parse(localStorage.getItem('circuitCity.entitlements')) ?? [] }
        catch { return [] }
    }

    // Merges purchased skus into the Garage's owned-cosmetics lists, the
    // same place credit-bought cosmetics live -- premium items equip the
    // same way once owned, no separate "premium inventory" to manage.
    grantOwned()
    {
        const garage = this.game.garage
        if(!garage)
            return

        let changed = false

        for(const sku of this.entitlements)
        {
            const [ kind, key ] = sku.split(':')
            const ownedKey = kind === 'paint' ? 'ownedPaints' : kind === 'outfit' ? 'ownedOutfits' : 'ownedSkins'

            if(garage.state[ownedKey] && !garage.state[ownedKey].includes(key))
            {
                garage.state[ownedKey].push(key)
                changed = true
            }
        }

        if(changed)
            garage.save()
    }

    async refresh()
    {
        try
        {
            const response = await fetch(`${this.baseUrl}/api/entitlements/${this.playerId}`)
            if(!response.ok)
                return

            const { items } = await response.json()
            this.entitlements = items ?? []
            localStorage.setItem('circuitCity.entitlements', JSON.stringify(this.entitlements))
            this.grantOwned()
            this.game.garage?.render()
        }
        catch
        {
            // Store unreachable -- premium rows just stay unpurchased, same
            // as multiplayer staying "Offline" when its server is down.
        }
    }

    async checkout(kind, key)
    {
        if(!this.baseUrl)
        {
            window.alert('The store isn\'t set up yet — ask the studio to configure VITE_STORE_URL.')
            return
        }

        let response

        try
        {
            response = await fetch(`${this.baseUrl}/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: this.playerId, kind, key }),
            })
        }
        catch
        {
            window.alert('Couldn\'t reach the store — check your connection and try again.')
            return
        }

        if(!response.ok)
        {
            window.alert('Checkout failed — try again in a moment.')
            return
        }

        const { url } = await response.json()
        window.location.href = url
    }

    // Stripe redirects back with ?purchase=success or ?purchase=cancelled --
    // strip it from the URL either way, and if it succeeded, refresh
    // entitlements shortly after (the webhook grant can lag the redirect
    // by a second or two).
    consumeReturnParams()
    {
        const params = new URLSearchParams(window.location.search)
        if(!params.has('purchase'))
            return

        const succeeded = params.get('purchase') === 'success'
        params.delete('purchase')

        const query = params.toString()
        const clean = window.location.pathname + (query ? `?${query}` : '') + window.location.hash
        window.history.replaceState({}, '', clean)

        if(succeeded)
        {
            this.game.notifications?.show?.('Purchase complete — check the Garage!')
            window.setTimeout(() => this.refresh(), 1500)
        }
    }
}
