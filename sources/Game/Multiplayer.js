import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { truckPaints } from '../data/upgrades.js'

// Lightweight multiplayer: broadcasts the local player's position/paint over
// the existing Server websocket and renders every other connected player as
// a translucent "ghost" car. Reuses Server.js (already wired for whispers
// and the circuit leaderboard) rather than opening a second connection.
//
// This only does anything if VITE_SERVER_URL points at a server that
// understands the mpJoin/mpState/mpLeave message types below — see
// server/README.md for a reference relay implementation.
export class Multiplayer
{
    constructor()
    {
        this.game = Game.getInstance()

        this.players = new Map()
        this.sendInterval = 0.15
        this.sendTimer = 0
        this.staleTimeout = 8
        this.ghostMaterials = new Map()

        this.setGeometry()
        this.setHud()
        this.setNetworking()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 12)
    }

    setGeometry()
    {
        this.ghostGeometry = new THREE.BoxGeometry(1.7, 0.9, 3.4)
    }

    setHud()
    {
        this.hud = {}
        this.hud.status = this.game.domElement.querySelector('.js-multiplayer-status-text')
        this.hud.players = this.game.domElement.querySelector('.js-multiplayer-players')
        this.updateStatusHud(this.game.server.connected)
    }

    updateStatusHud(connected)
    {
        if(!this.hud.status)
            return

        if(connected)
        {
            const count = this.players.size
            this.hud.status.textContent = count > 0
                ? `Online — ${count} other player${count > 1 ? 's' : ''} on the island`
                : 'Online — you\'re the only one here right now'
        }
        else
        {
            this.hud.status.textContent = 'Offline'
        }
    }

    setNetworking()
    {
        this.game.server.events.on('connected', () =>
        {
            this.updateStatusHud(true)
            this.sendJoin()
        })

        this.game.server.events.on('disconnected', () =>
        {
            this.updateStatusHud(false)
            this.clearAll()
        })

        this.game.server.events.on('message', (data) =>
        {
            if(data.type === 'mpState')
                this.onPlayerState(data)
            else if(data.type === 'mpLeave')
                this.removePlayer(data.uuid)
        })

        if(this.game.server.connected)
        {
            this.updateStatusHud(true)
            this.sendJoin()
        }
    }

    sendJoin()
    {
        this.game.server.send({ type: 'mpJoin' })
    }

    getGhostMaterial(paintName)
    {
        const key = paintName ?? 'default'

        if(this.ghostMaterials.has(key))
            return this.ghostMaterials.get(key)

        const hex = truckPaints[paintName]?.colorA ?? '#00e5ff'
        const material = new THREE.MeshBasicNodeMaterial({ color: hex, transparent: true, opacity: 0.55 })
        material.fog = false
        this.ghostMaterials.set(key, material)

        return material
    }

    createPlayer(uuid)
    {
        const mesh = new THREE.Mesh(this.ghostGeometry, this.getGhostMaterial(null))
        mesh.position.set(0, -50, 0)
        this.game.scene.add(mesh)

        const player = {
            uuid,
            mesh,
            targetPosition: new THREE.Vector3(0, -50, 0),
            targetRotationY: 0,
            lastUpdate: this.game.ticker.elapsed,
            paint: null,
        }

        this.players.set(uuid, player)

        return player
    }

    onPlayerState(data)
    {
        if(!data.uuid || data.uuid === this.game.server.uuid)
            return

        let player = this.players.get(data.uuid)
        const isNew = !player

        if(isNew)
            player = this.createPlayer(data.uuid)

        player.targetPosition.set(data.x, data.y, data.z)
        player.targetRotationY = data.rotationY ?? 0
        player.lastUpdate = this.game.ticker.elapsed

        if(player.paint !== data.paint)
        {
            player.paint = data.paint
            player.mesh.material = this.getGhostMaterial(data.paint)
        }

        if(isNew)
            this.updatePlayersHud()
    }

    removePlayer(uuid)
    {
        const player = this.players.get(uuid)

        if(!player)
            return

        this.game.scene.remove(player.mesh)
        this.players.delete(uuid)
        this.updatePlayersHud()
    }

    clearAll()
    {
        for(const uuid of [...this.players.keys()])
            this.removePlayer(uuid)
    }

    updatePlayersHud()
    {
        this.updateStatusHud(this.game.server.connected)

        if(!this.hud.players)
            return

        this.hud.players.innerHTML = ''

        for(const [ uuid, player ] of this.players)
        {
            const row = document.createElement('div')
            row.classList.add('player-row')

            const swatch = document.createElement('span')
            swatch.classList.add('swatch')
            swatch.style.background = truckPaints[player.paint]?.colorA ?? '#00e5ff'

            const label = document.createElement('span')
            label.textContent = `Racer ${uuid.slice(0, 4).toUpperCase()}`

            row.append(swatch, label)
            this.hud.players.append(row)
        }
    }

    update()
    {
        if(this.game.server.connected)
        {
            this.sendTimer -= this.game.ticker.delta

            if(this.sendTimer <= 0)
            {
                this.sendTimer = this.sendInterval

                const onFoot = this.game.character?.active
                const position = onFoot ? this.game.character.position : this.game.physicalVehicle.position
                const rotationY = onFoot ? this.game.character.rotationY : this.game.physicalVehicle.yRotation

                this.game.server.send({
                    type: 'mpState',
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    rotationY,
                    paint: this.game.garage?.state.equippedPaint ?? null,
                })
            }
        }

        const now = this.game.ticker.elapsed
        const lerpFactor = Math.min(1, this.game.ticker.deltaScaled * 6)

        for(const [ uuid, player ] of this.players)
        {
            if(now - player.lastUpdate > this.staleTimeout)
            {
                this.removePlayer(uuid)
                continue
            }

            player.mesh.position.lerp(player.targetPosition, lerpFactor)

            let angleDelta = player.targetRotationY - player.mesh.rotation.y
            angleDelta = ((angleDelta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
            player.mesh.rotation.y += angleDelta * lerpFactor
        }
    }
}
