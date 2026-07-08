import { Game } from './Game.js'

// A small always-on radar-style minimap in the corner of the HUD: a
// cropped, zoomed window into the same map texture the full map modal
// (M key) uses, panned to keep the player centered, with a rotating
// player arrow and live blips for missions, the current story camp,
// player bases and other connected multiplayer players.
export class MiniMap
{
    constructor()
    {
        this.game = Game.getInstance()

        this.zoom = 2.6
        this.viewportSize = 150

        this.element = this.game.domElement.querySelector('.js-minimap')
        if(!this.element)
            return

        this.textureElement = this.element.querySelector('.js-minimap-texture')
        this.blipsContainer = this.element.querySelector('.js-minimap-blips')
        this.playerElement = this.element.querySelector('.js-minimap-player')

        this.blips = { story: null, players: new Map() }

        this.setTexture()
        this.setStaticBlips()
        this.setToggle()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 14)
    }

    worldToMap(coordinates)
    {
        let x = coordinates.x
        let y = typeof coordinates.z !== 'undefined' ? coordinates.z : coordinates.y

        x = x / this.game.terrain.size + 0.5
        y = y / this.game.terrain.size + 0.5

        return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
    }

    setTexture()
    {
        this.previousUrl = null

        this.updateTexture = () =>
        {
            const url = this.game.dayCycles.intervalEvents.get('night').inInterval ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp'

            if(url !== this.previousUrl)
            {
                this.previousUrl = url
                this.textureElement.src = url
            }
        }

        this.updateTexture()
    }

    createBlip(className, label = '')
    {
        const element = document.createElement('div')
        element.classList.add('blip', className)
        if(label)
            element.title = label
        this.blipsContainer.append(element)
        return element
    }

    setStaticBlips()
    {
        this.blips.mission = this.game.missions.startMarkers.map((item) => ({
            item,
            element: this.createBlip('blip-mission', item.mission.name),
        }))

        this.blips.bases = this.game.world.bases.list.map((base) => ({
            base,
            element: this.createBlip('blip-compound', base.name),
        }))
    }

    setToggle()
    {
        this.game.inputs.addActions([
            { name: 'minimapToggle', categories: [ 'wandering' ], keys: [ 'Keyboard.KeyN' ] },
        ])
        this.game.inputs.events.on('minimapToggle', (action) =>
        {
            if(action.active)
                this.element.classList.toggle('is-hidden')
        })
    }

    positionBlip(element, worldPosition, panX, panY)
    {
        const mapPosition = this.worldToMap(worldPosition)
        const size = this.game.terrain.size * this.zoom
        const x = mapPosition.x * size - panX + this.viewportSize * 0.5
        const y = mapPosition.y * size - panY + this.viewportSize * 0.5

        element.style.left = `${x}px`
        element.style.top = `${y}px`
        element.style.display = (x < -10 || x > this.viewportSize + 10 || y < -10 || y > this.viewportSize + 10) ? 'none' : 'block'
    }

    update()
    {
        if(!this.element || this.element.classList.contains('is-hidden'))
            return

        this.updateTexture()

        const playerPosition = this.game.player.position
        const playerRotation = this.game.character?.active ? this.game.character.rotationY : this.game.physicalVehicle.yRotation
        const mapPosition = this.worldToMap(playerPosition)
        const size = this.game.terrain.size * this.zoom

        const panX = mapPosition.x * size
        const panY = mapPosition.y * size

        this.textureElement.style.width = `${size}px`
        this.textureElement.style.height = `${size}px`
        this.textureElement.style.transform = `translate(${-panX + this.viewportSize * 0.5}px, ${-panY + this.viewportSize * 0.5}px)`

        if(this.playerElement)
            this.playerElement.style.transform = `translate(-50%, -50%) rotate(${-playerRotation}rad)`

        for(const { item, element } of this.blips.mission)
            this.positionBlip(element, item.mission.start, panX, panY)

        for(const { base, element } of this.blips.bases)
            this.positionBlip(element, base.center, panX, panY)

        // Story camp (dynamic)
        const camp = this.game.story.currentCamp
        if(camp)
        {
            if(!this.blips.story)
                this.blips.story = this.createBlip('blip-story', 'Story objective')

            this.positionBlip(this.blips.story, camp.center, panX, panY)
        }
        else if(this.blips.story)
        {
            this.blips.story.remove()
            this.blips.story = null
        }

        // Other players (dynamic)
        const activeUuids = new Set()
        for(const [ uuid, player ] of this.game.multiplayer.players)
        {
            activeUuids.add(uuid)

            let element = this.blips.players.get(uuid)
            if(!element)
            {
                element = this.createBlip('blip-player')
                this.blips.players.set(uuid, element)
            }

            this.positionBlip(element, player.mesh.position, panX, panY)
        }

        for(const [ uuid, element ] of this.blips.players)
        {
            if(!activeUuids.has(uuid))
            {
                element.remove()
                this.blips.players.delete(uuid)
            }
        }
    }
}
