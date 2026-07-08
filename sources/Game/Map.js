import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { clamp } from 'three/src/math/MathUtils.js'
import { Game } from './Game.js'

export class Map
{
    constructor()
    {
        this.game = Game.getInstance()

        this.initiated = false
        this.modal = this.game.modals.items.get('map')
        this.element = this.modal.element.querySelector('.js-map-container')

        this.setTrigger()
        this.setInputs()

        this.modal.events.on('open', () =>
        {
            if(!this.initiated)
                this.init()

            this.texture.update()
        })
    }

    init()
    {
        this.initiated = true

        this.setLocations()
        this.setBlips()
        this.setPlayer()
        this.setTexture()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 14)
    }

    setLocations()
    {
        this.locations = {}
        this.locations.items = [
            { name: 'Achievements', respawnName: 'achievements', offset: { x: 0, y: -0.01 } },
            { name: 'Altar', respawnName: 'altar', offset: { x: 0, y: -0.05 } },
            { name: 'Behind<br /> the scene', respawnName: 'behindTheScene', offset: { x: 0.01, y: 0 } },
            { name: 'Bowling', respawnName: 'bowling', offset: { x: -0.08, y: 0.03 } },
            { name: 'Career', respawnName: 'career', offset: { x: 0, y: -0.06 } },
            { name: 'Circuit', respawnName: 'circuit', offset: { x: -0.08, y: -0.05 } },
            { name: 'Cookie', respawnName: 'cookie', offset: { x: -0.02, y: -0.01 } },
            { name: 'Lab', respawnName: 'lab', offset: { x: -0.03, y: 0 } },
            { name: 'Landing', respawnName: 'landing', offset: { x: 0.02, y: 0 } },
            { name: 'Projects', respawnName: 'projects', offset: { x: 0, y: -0.02 } },
            { name: 'Social', respawnName: 'social', offset: { x: -0.01, y: -0.04 } },
            { name: 'Time Machine', respawnName: 'timeMachine', offset: { x: 0, y: 0 } },

            // Circuit City fast travel — the new scatter districts
            { name: 'Downtown', position: { x: -72, y: 4, z: 58 }, rotationY: 0, offset: { x: 0, y: -0.02 }, isFastTravel: true },
            { name: 'Shop Strip', position: { x: 92, y: 4, z: 8 }, rotationY: Math.PI * 0.5, offset: { x: 0.02, y: 0 }, isFastTravel: true },
            { name: 'Fishing Village', position: { x: -30, y: 4, z: 42 }, rotationY: 0, offset: { x: 0, y: -0.02 }, isFastTravel: true },
            { name: 'Coastal Homes', position: { x: 48, y: 4, z: 55 }, rotationY: 0, offset: { x: 0, y: -0.02 }, isFastTravel: true },
            { name: 'Havoc Compound', position: this.game.world.base.center, rotationY: 0, offset: { x: 0, y: 0.03 }, isFastTravel: true },
        ]

        for(const item of this.locations.items)
        {
            const respawnPosition = item.isFastTravel ? item.position : this.game.respawns.getByName(item.respawnName).position
            const mapPosition = this.worldToMap(respawnPosition)

            // HTML
            const html = /* html */`
                <div class="pin"></div>
                <div class="name-container">
                    <div class="name">${item.name}</div>
                </div>
            `

            const element = document.createElement('div')
            element.classList.add('location')
            if(item.isFastTravel)
                element.classList.add('is-fast-travel')
            element.innerHTML = html
            element.style.left = `${(mapPosition.x + item.offset.x)* 100}%`
            element.style.top = `${(mapPosition.y + item.offset.y)* 100}%`
            element.style.zIndex = Math.round(mapPosition.y * 1000)

            this.element.append(element)

            element.addEventListener('click', () =>
            {
                this.game.modals.close()

                if(item.isFastTravel)
                    this.fastTravelTo(item.position, item.rotationY ?? 0)
                else
                {
                    this.game.player.respawn(item.respawnName, () =>
                    {
                        this.game.view.focusPoint.isTracking = true
                    })
                }
            })
        }
    }

    // Fast travel: fade to the overlay, teleport out of view, hold a cinematic
    // establishing shot of the destination, then fade the overlay back out and
    // hand the camera back to normal driving/on-foot control.
    fastTravelTo(position, rotationY = 0)
    {
        this.game.overlay.show(() =>
        {
            if(this.game.character?.active)
            {
                this.game.character.body.setTranslation({ x: position.x, y: position.y ?? 4, z: position.z }, true)
                this.game.character.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            }
            else
            {
                this.game.physicalVehicle.moveTo({ x: position.x, y: position.y ?? 4, z: position.z }, rotationY)
            }

            this.game.view.focusPoint.isTracking = false
            this.game.view.focusPoint.trackedPosition.set(position.x, 0, position.z)
            this.game.view.focusPoint.position.copy(this.game.view.focusPoint.trackedPosition)
            this.game.view.focusPoint.smoothedPosition.copy(this.game.view.focusPoint.trackedPosition)

            const cameraPosition = new THREE.Vector3(
                position.x + Math.sin(rotationY + 0.7) * 18,
                (position.y ?? 4) + 11,
                position.z + Math.cos(rotationY + 0.7) * 18
            )
            const cameraTarget = new THREE.Vector3(position.x, position.y ?? 4, position.z)
            this.game.view.cinematic.start(cameraPosition, cameraTarget)

            this.game.overlay.hide()

            gsap.delayedCall(2.4, () =>
            {
                this.game.view.cinematic.end()
                this.game.view.focusPoint.isTracking = true
            })
        })
    }
    
    setBlips()
    {
        this.blips = { mission: [], story: null, compound: null, players: new Map() }

        const createBlip = (worldPosition, className, label = '') =>
        {
            const mapPosition = this.worldToMap(worldPosition)

            const element = document.createElement('div')
            element.classList.add('blip', className)
            element.style.left = `${mapPosition.x * 100}%`
            element.style.top = `${mapPosition.y * 100}%`
            if(label)
                element.title = label

            this.element.append(element)

            return element
        }

        // Mission beacons
        for(const item of this.game.missions.startMarkers)
        {
            const element = createBlip(item.mission.start, 'blip-mission', item.mission.name)
            this.blips.mission.push({ item, element })
        }

        // Havoc Compound / Havoc Nights
        this.blips.compound = createBlip(this.game.world.base.center, 'blip-compound', 'Havoc Compound')
    }

    updateBlips()
    {
        for(const { item, element } of this.blips.mission)
        {
            const done = this.game.missions.completed.has(item.mission.id)
            element.classList.toggle('is-done', done)
        }

        // Story camp blip: create/move/remove as chapters progress
        const camp = this.game.story.currentCamp

        if(camp)
        {
            if(!this.blips.story)
            {
                const mapPosition = this.worldToMap(camp.center)
                const element = document.createElement('div')
                element.classList.add('blip', 'blip-story')
                element.title = 'Story objective'
                this.element.append(element)
                this.blips.story = element
            }

            const mapPosition = this.worldToMap(camp.center)
            this.blips.story.style.left = `${mapPosition.x * 100}%`
            this.blips.story.style.top = `${mapPosition.y * 100}%`
        }
        else if(this.blips.story)
        {
            this.blips.story.remove()
            this.blips.story = null
        }

        // Other players
        const activeUuids = new Set()

        for(const [ uuid, player ] of this.game.multiplayer.players)
        {
            activeUuids.add(uuid)

            let element = this.blips.players.get(uuid)

            if(!element)
            {
                element = document.createElement('div')
                element.classList.add('blip', 'blip-player')
                this.element.append(element)
                this.blips.players.set(uuid, element)
            }

            const mapPosition = this.worldToMap(player.mesh.position)
            element.style.left = `${mapPosition.x * 100}%`
            element.style.top = `${mapPosition.y * 100}%`
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

    setPlayer()
    {
        this.player = {}
        this.player.element = this.element.querySelector('.js-player')
        this.player.roundedPosition = { x: 0, y: 0 }
    }
    
    setTexture()
    {
        this.texture = {}
        this.texture.element = this.element.querySelector('.js-texture')
        this.texture.previousUrl = null

        this.texture.element.addEventListener('load', () =>
        {
            this.texture.element.classList.add('is-visible')
        })
        
        this.texture.update = () =>
        {
            const url = this.game.dayCycles.intervalEvents.get('night').inInterval ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp'

            if(url !== this.texture.previousUrl)
            {
                this.texture.element.classList.remove('is-visible')
                this.texture.previousUrl = url
                this.texture.element.src = url
            }
        }
    }

    setTrigger()
    {
        const element = this.game.domElement.querySelector('.js-map-trigger')
        
        element.addEventListener('click', (event) =>
        {
            this.game.modals.open('map')
        })
        element.addEventListener('keydown', (event) =>
        {
            event.preventDefault()
        })
    }

    setInputs()
    {
        // Inputs keyboard
        this.game.inputs.addActions([
            { name: 'map', categories: [ 'modal', 'menu', 'wandering' ], keys: [ 'Keyboard.m', 'Keyboard.KeyM' ] },
        ])
        this.game.inputs.events.on('map', (action) =>
        {
            if(action.active)
            {
                if(!this.modal.isOpen)
                    this.game.modals.open('map')
                else
                    this.game.modals.close()
            }
        })
    }

    worldToMap(coordinates)
    {
        let x = coordinates.x
        let y = typeof coordinates.z !== 'undefined' ? coordinates.z : coordinates.y

        x /= this.game.terrain.size
        y /= this.game.terrain.size

        x += 0.5
        y += 0.5

        x = clamp(x, 0, 1)
        y = clamp(y, 0, 1)

        return { x, y }
    }

    update()
    {
        if(!this.modal.isOpen)
            return

        this.updateBlips()

        const playerRoundedX = Math.round(this.game.player.position.x)
        const playerRoundedY = Math.round(this.game.player.position.z)

        if(playerRoundedX !== this.player.roundedPosition.x || playerRoundedY !== this.player.roundedPosition.y)
        {
            this.player.roundedPosition.x = playerRoundedX
            this.player.roundedPosition.y = playerRoundedY

            const playerCoordinates = this.worldToMap(this.player.roundedPosition)
            const x = Math.round(playerCoordinates.x * 1000) / 10
            const y = Math.round(playerCoordinates.y * 1000) / 10

            this.player.element.style.left = `${x}%`
            this.player.element.style.top = `${y}%`
            this.player.element.style.transform = `rotate(${-this.game.physicalVehicle.yRotation}rad)`
        }
    }
}