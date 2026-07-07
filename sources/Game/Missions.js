import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import missionsData from '../data/missions.js'

export class Missions
{
    static STATE_IDLE = 1
    static STATE_ACTIVE = 2

    constructor()
    {
        this.game = Game.getInstance()

        this.state = Missions.STATE_IDLE
        this.active = null
        this.startRadius = 3.5
        this.hitRadius = 3.5

        this.setSave()
        this.setSounds()
        this.setGeometries()
        this.setMaterials()
        this.setHud()
        this.setStartMarkers()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setSave()
    {
        const cash = localStorage.getItem('neonHavoc.cash')
        this.cash = cash ? parseInt(cash) : 0

        let completed = []
        try { completed = JSON.parse(localStorage.getItem('neonHavoc.completed')) ?? [] }
        catch { completed = [] }
        this.completed = new Set(completed)

        // Sync achievements with saved progress
        for(const id of this.completed)
            this.game.achievements.setProgress('missions', id)

        if(this.cash > 0 && this.game.achievements.groups.get('cash') && this.cash > this.game.achievements.groups.get('cash').progress)
            this.game.achievements.setProgress('cash', this.cash)
    }

    save()
    {
        localStorage.setItem('neonHavoc.cash', this.cash)
        localStorage.setItem('neonHavoc.completed', JSON.stringify([...this.completed]))
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.start = this.game.audio.register({
            path: 'sounds/circuit/countdown/Game Start Countdown 31-2.mp3',
            autoplay: false,
            volume: 0.5,
        })
        this.sounds.checkpoint = this.game.audio.register({
            path: 'sounds/circuit/checkpoint/Win Score 1.mp3',
            autoplay: false,
            volume: 0.5,
            antiSpam: 0.2,
        })
        this.sounds.complete = this.game.audio.register({
            path: 'sounds/circuit/finish/Big Win Fanfare 2.mp3',
            autoplay: false,
            volume: 0.5,
        })
        this.sounds.cash = this.game.audio.register({
            path: 'sounds/achievements/Money Reward 2.mp3',
            autoplay: false,
            volume: 0.5,
        })
        this.sounds.fail = this.game.audio.register({
            path: 'sounds/bell/Death Hit.mp3',
            autoplay: false,
            volume: 0.4,
        })
    }

    setGeometries()
    {
        this.geometries = {}
        this.geometries.ring = new THREE.TorusGeometry(2.4, 0.16, 12, 48)
        this.geometries.orb = new THREE.IcosahedronGeometry(0.7, 1)
        this.geometries.beacon = new THREE.CylinderGeometry(0.4, 0.4, 12, 12, 1, true)
        this.geometries.beacon.translate(0, 6, 0)
    }

    setMaterials()
    {
        this.materials = {}
        this.materials.start = this.game.materials.createEmissive('missionStart', '#00e5ff', 2.5)
        this.materials.startDone = this.game.materials.createEmissive('missionStartDone', '#8b93b8', 1.2)
        this.materials.checkpoint = this.game.materials.createEmissive('missionCheckpoint', '#ff2ea0', 2.5)
        this.materials.orb = this.game.materials.createEmissive('missionOrb', '#ffd23f', 3)
        this.materials.delivery = this.game.materials.createEmissive('missionDelivery', '#54ff9f', 2.5)

        this.materials.beacon = (hexColor) =>
        {
            const material = new THREE.MeshBasicNodeMaterial({
                color: hexColor,
                transparent: true,
                opacity: 0.14,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
            material.fog = false
            return material
        }

        this.beaconMaterials = {
            start: this.materials.beacon('#00e5ff'),
            startDone: this.materials.beacon('#8b93b8'),
            checkpoint: this.materials.beacon('#ff2ea0'),
            delivery: this.materials.beacon('#54ff9f'),
        }
    }

    setHud()
    {
        this.hud = {}
        this.hud.element = this.game.domElement.querySelector('.js-havoc-hud')
        this.hud.cashValue = this.hud.element.querySelector('.js-cash-value')
        this.hud.panel = this.hud.element.querySelector('.js-mission-panel')
        this.hud.name = this.hud.element.querySelector('.js-mission-name')
        this.hud.objective = this.hud.element.querySelector('.js-mission-objective')
        this.hud.timer = this.hud.element.querySelector('.js-mission-timer')
        this.hud.progress = this.hud.element.querySelector('.js-mission-progress')

        this.updateCashHud()

        // Visibility option
        const visible = localStorage.getItem('neonHavoc.hud') !== 'off'
        this.setHudVisible(visible)
    }

    setHudVisible(visible)
    {
        this.hudVisible = visible
        localStorage.setItem('neonHavoc.hud', visible ? 'on' : 'off')
        this.hud.element.classList.toggle('is-hidden', !visible)
    }

    updateCashHud()
    {
        this.hud.cashValue.textContent = this.cash.toLocaleString('en-US')
    }

    addCash(amount)
    {
        this.cash += amount
        this.save()
        this.updateCashHud()

        if(this.game.achievements.groups.get('cash') && this.cash > this.game.achievements.groups.get('cash').progress)
            this.game.achievements.setProgress('cash', this.cash)
    }

    createMarker(type, position, baseY = 0)
    {
        const group = new THREE.Group()
        group.position.set(position.x, baseY, position.z)

        const ring = new THREE.Mesh(this.geometries.ring, this.materials[type])
        ring.rotation.x = - Math.PI * 0.5
        ring.position.y = 0.4
        group.add(ring)

        const beacon = new THREE.Mesh(this.geometries.beacon, this.beaconMaterials[type])
        group.add(beacon)

        group.userData.ring = ring
        group.userData.beacon = beacon

        this.game.scene.add(group)

        return group
    }

    setStartMarkers()
    {
        this.startMarkers = []

        for(const mission of missionsData)
        {
            const done = this.completed.has(mission.id)
            const type = done ? 'startDone' : 'start'
            const group = this.createMarker(type, mission.start, mission.start.y ?? 0)

            this.startMarkers.push({ mission, group })
        }
    }

    refreshStartMarker(item)
    {
        const done = this.completed.has(item.mission.id)
        item.group.userData.ring.material = done ? this.materials.startDone : this.materials.start
        item.group.userData.beacon.material = done ? this.beaconMaterials.startDone : this.beaconMaterials.start
    }

    setStartMarkersVisible(visible)
    {
        for(const item of this.startMarkers)
            item.group.visible = visible
    }

    startMission(mission)
    {
        this.state = Missions.STATE_ACTIVE
        this.setStartMarkersVisible(false)

        this.active = {
            mission,
            index: 0,
            hits: 0,
            timeLeft: mission.timeLimit,
            objectives: [],
        }

        // Spawn objectives
        if(mission.type === 'checkpoints')
        {
            for(const point of mission.points)
            {
                const group = this.createMarker('checkpoint', point, point.y ?? 0)
                group.visible = false
                this.active.objectives.push({ point, group, done: false })
            }
            this.active.objectives[0].group.visible = true
        }
        else if(mission.type === 'collect')
        {
            for(const point of mission.points)
            {
                const group = new THREE.Group()
                group.position.set(point.x, point.y ?? 0, point.z)

                const orb = new THREE.Mesh(this.geometries.orb, this.materials.orb)
                orb.position.y = 1.4
                group.add(orb)

                const beacon = new THREE.Mesh(this.geometries.beacon, this.beaconMaterials.checkpoint)
                beacon.scale.set(0.5, 0.5, 0.5)
                group.add(beacon)

                group.userData.orb = orb
                this.game.scene.add(group)
                this.active.objectives.push({ point, group, done: false })
            }
        }
        else if(mission.type === 'delivery')
        {
            const point = mission.points[0]
            const group = this.createMarker('delivery', point, point.y ?? 0)
            group.userData.beacon.scale.set(1.6, 1.6, 1.6)
            this.active.objectives.push({ point, group, done: false })
        }

        // Hud
        this.hud.panel.classList.remove('is-hidden')
        this.hud.name.textContent = mission.name
        this.hud.objective.textContent = mission.tagline
        this.hud.timer.classList.remove('is-danger')
        this.updateProgressHud()

        // Sound and notification
        this.sounds.start.play()
        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🏁 ${mission.name}</div>
                </div>
                <div class="bottom">
                    <div class="description">${mission.tagline} — ${mission.timeLimit}s</div>
                </div>
            `,
            'mission',
            4,
            null,
            `mission-start-${mission.id}`
        )
    }

    updateProgressHud()
    {
        const mission = this.active.mission
        const total = mission.points.length
        const hits = this.active.hits

        if(mission.type === 'delivery')
            this.hud.progress.textContent = 'DELIVER'
        else
            this.hud.progress.textContent = `${hits} / ${total}`
    }

    clearObjectives()
    {
        if(!this.active)
            return

        for(const objective of this.active.objectives)
        {
            this.game.scene.remove(objective.group)
        }
    }

    completeMission()
    {
        const mission = this.active.mission
        const firstTime = !this.completed.has(mission.id)

        this.completed.add(mission.id)
        this.cash += mission.reward
        this.save()
        this.updateCashHud()

        // Achievements
        this.game.achievements.setProgress('missions', mission.id)
        if(this.game.achievements.groups.get('cash') && this.cash > this.game.achievements.groups.get('cash').progress)
            this.game.achievements.setProgress('cash', this.cash)

        // Sounds
        this.sounds.complete.play()
        this.sounds.cash.play()

        // Notification
        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">✅ Mission complete</div>
                </div>
                <div class="bottom">
                    <div class="description">${mission.name} — +${mission.reward} CR${firstTime ? '' : ' (replay)'}</div>
                </div>
            `,
            'mission',
            5,
            null,
            `mission-complete-${mission.id}`
        )

        this.endMission()
    }

    failMission()
    {
        const mission = this.active.mission

        this.sounds.fail.play()
        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">💀 Mission failed</div>
                </div>
                <div class="bottom">
                    <div class="description">${mission.name} — drive back to the blue beacon to retry</div>
                </div>
            `,
            'mission',
            5,
            null,
            `mission-fail-${mission.id}`
        )

        this.endMission()
    }

    endMission()
    {
        // Don't instantly restart if the player is parked on a start ring
        this.lockedStartId = this.active.mission.id

        this.clearObjectives()
        this.active = null
        this.state = Missions.STATE_IDLE
        this.hud.panel.classList.add('is-hidden')

        for(const item of this.startMarkers)
            this.refreshStartMarker(item)

        this.setStartMarkersVisible(true)
    }

    getPlayerPosition()
    {
        // On foot, the character is the player
        if(this.game.character && this.game.character.active)
            return this.game.character.position

        return this.game.player.position
    }

    testHit(point, baseY, radius)
    {
        const playerPosition = this.getPlayerPosition()
        const distance = Math.hypot(playerPosition.x - point.x, playerPosition.z - point.z)

        return distance < radius && playerPosition.y > baseY - 2 && playerPosition.y < baseY + 6
    }

    update()
    {
        const elapsed = this.game.ticker.elapsed
        const delta = this.game.ticker.delta

        if(this.state === Missions.STATE_IDLE)
        {
            // Animate start markers
            for(const item of this.startMarkers)
            {
                const ring = item.group.userData.ring
                ring.rotation.z = elapsed * 0.8
                ring.position.y = 0.4 + Math.sin(elapsed * 2 + item.group.position.x) * 0.1
            }

            // Player might not be ready yet
            if(!this.game.player)
                return

            // Test mission start
            for(const item of this.startMarkers)
            {
                const inside = this.testHit(item.mission.start, item.mission.start.y ?? 0, this.startRadius)

                // Wait for the player to leave the ring of the mission that just ended
                if(this.lockedStartId === item.mission.id)
                {
                    if(!inside)
                        this.lockedStartId = null

                    continue
                }

                if(inside)
                {
                    this.startMission(item.mission)
                    break
                }
            }
        }
        else if(this.state === Missions.STATE_ACTIVE)
        {
            const mission = this.active.mission

            // Timer
            this.active.timeLeft -= delta

            if(this.active.timeLeft <= 0)
            {
                this.failMission()
                return
            }

            // Timer hud
            const timeLeft = this.active.timeLeft
            const minutes = Math.floor(timeLeft / 60)
            const seconds = Math.floor(timeLeft % 60)
            this.hud.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
            this.hud.timer.classList.toggle('is-danger', timeLeft < 10)

            // Animate and test objectives
            if(mission.type === 'checkpoints')
            {
                const current = this.active.objectives[this.active.index]
                const ring = current.group.userData.ring
                ring.rotation.z = elapsed * 1.5
                ring.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08)

                if(this.testHit(current.point, current.point.y ?? 0, this.hitRadius))
                {
                    current.done = true
                    current.group.visible = false
                    this.active.hits++
                    this.active.index++
                    this.sounds.checkpoint.play()
                    this.updateProgressHud()

                    if(this.active.index >= this.active.objectives.length)
                        this.completeMission()
                    else
                        this.active.objectives[this.active.index].group.visible = true
                }
            }
            else if(mission.type === 'collect')
            {
                let allDone = true

                for(const objective of this.active.objectives)
                {
                    if(objective.done)
                        continue

                    allDone = false

                    const orb = objective.group.userData.orb
                    orb.rotation.y = elapsed * 2
                    orb.rotation.x = elapsed * 1.3
                    orb.position.y = 1.4 + Math.sin(elapsed * 3 + objective.point.x) * 0.3

                    if(this.testHit(objective.point, objective.point.y ?? 0, 2.8))
                    {
                        objective.done = true
                        objective.group.visible = false
                        this.active.hits++
                        this.sounds.checkpoint.play()
                        this.updateProgressHud()
                    }
                }

                if(allDone)
                    this.completeMission()
            }
            else if(mission.type === 'delivery')
            {
                const objective = this.active.objectives[0]
                const ring = objective.group.userData.ring
                ring.rotation.z = elapsed * 1.5
                ring.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.08)

                if(this.testHit(objective.point, objective.point.y ?? 0, this.hitRadius))
                {
                    this.active.hits++
                    this.completeMission()
                }
            }
        }
    }
}
