import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { InteractivePoints } from '../InteractivePoints.js'

// A hidden door tucked behind the waterfall cliff. Walk up and interact to
// unlock the secret "Prototype X" truck paint back at the Garage.
export class SecretDoor
{
    constructor()
    {
        this.game = Game.getInstance()

        this.position = new THREE.Vector3(-95, 3, 5.5)
        this.found = localStorage.getItem('circuitCity.secretDoor') === 'true'

        this.setMesh()
        this.setInteractivePoint()
    }

    setMesh()
    {
        const material = new MeshDefaultMaterial({
            colorNode: color(this.found ? '#54ff9f' : '#1a1626'),
            hasCoreShadows: true,
            hasDropShadows: true,
        })

        const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), material)
        door.position.copy(this.position)
        door.castShadow = true
        door.receiveShadow = true
        this.mesh = door
        this.game.scene.add(door)

        this.frameMaterial = this.game.materials.createEmissive('secretDoorFrame', '#00e5ff', 1.8)
        const frame = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 8, 4), this.frameMaterial)
        frame.rotation.z = Math.PI * 0.25
        frame.scale.set(1, 1.3, 1)
        frame.position.set(this.position.x, this.position.y + 0.1, this.position.z - 0.15)
        this.game.scene.add(frame)
    }

    setInteractivePoint()
    {
        this.interactivePoint = this.game.interactivePoints.create(
            this.position,
            this.found ? 'Prototype X (found)' : 'A hidden door...',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.open()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems([ 'interact' ])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems([ 'interact' ])
            }
        )
    }

    open()
    {
        if(this.found)
            return

        this.found = true
        localStorage.setItem('circuitCity.secretDoor', 'true')

        this.mesh.material.colorNode = color('#54ff9f')
        this.mesh.material.needsUpdate = true

        if(!this.game.garage.state.ownedPaints.includes('prototypeX'))
        {
            this.game.garage.state.ownedPaints.push('prototypeX')
            this.game.garage.save()
        }

        this.game.achievements.setProgress('secretVehicle', 1)

        this.game.notifications.show(
            /* html */`
                <div class="top">
                    <div class="title">🔓 Secret found!</div>
                </div>
                <div class="bottom">
                    <div class="description">Prototype X paint unlocked -- equip it at the Garage.</div>
                </div>
            `,
            'secret',
            6,
            null,
            'secret-door'
        )
    }
}
