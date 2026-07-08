import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/**
 * The landing area's "BRUNO SIMON" lettering is baked directly into
 * areas.glb (10 static meshes named refLetters010-019) and can't be edited
 * without Blender. This hides that lettering and draws a programmatic
 * "CIRCUIT CITY" sign in its place, in the same spot and orientation.
 */
export class BrandSign
{
    constructor()
    {
        this.game = Game.getInstance()
        this.replace()
    }

    replace()
    {
        const letters = []
        this.game.scene.traverse((child) =>
        {
            if(child.isMesh && child.name.startsWith('refLetters'))
                letters.push(child)
        })

        if(letters.length === 0)
            return

        for(const letter of letters)
            letter.visible = false

        letters.sort((a, b) => a.name.localeCompare(b.name))

        const center = new THREE.Vector3()
        for(const letter of letters)
            center.add(letter.getWorldPosition(new THREE.Vector3()))
        center.divideScalar(letters.length)

        const first = letters[0].getWorldPosition(new THREE.Vector3())
        const last = letters[letters.length - 1].getWorldPosition(new THREE.Vector3())
        const direction = last.clone().sub(first)
        direction.y = 0
        if(direction.lengthSq() < 0.0001)
            direction.set(1, 0, 0)
        direction.normalize()

        const angle = Math.atan2(direction.x, direction.z)

        this.setMesh(center, angle)
    }

    setMesh(center, angle)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 220
        const context = canvas.getContext('2d')

        const gradient = context.createLinearGradient(0, 0, canvas.width, 0)
        gradient.addColorStop(0, '#00e5ff')
        gradient.addColorStop(0.5, '#b56bff')
        gradient.addColorStop(1, '#ff2ea0')

        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.font = '900 130px Nunito, Arial, sans-serif'
        context.fillStyle = gradient
        context.fillText('CIRCUIT CITY', canvas.width / 2, canvas.height / 2)

        const width = 10
        const height = width * (canvas.height / canvas.width)
        const geometry = new THREE.PlaneGeometry(width, height)

        // A plain double-sided plane renders the same UVs from both faces,
        // which mirrors the text when read from behind -- so build the sign
        // out of two back-to-back single-sided planes instead, the second
        // using a horizontally mirrored copy of the texture, so it reads
        // correctly from either direction.
        const textureFront = new THREE.CanvasTexture(canvas)
        textureFront.colorSpace = THREE.SRGBColorSpace
        textureFront.needsUpdate = true

        const textureBack = textureFront.clone()
        textureBack.wrapS = THREE.RepeatWrapping
        textureBack.repeat.x = -1
        textureBack.needsUpdate = true

        const materialFront = new THREE.MeshBasicMaterial({ map: textureFront, transparent: true, side: THREE.FrontSide, depthWrite: false })
        const materialBack = new THREE.MeshBasicMaterial({ map: textureBack, transparent: true, side: THREE.BackSide, depthWrite: false })

        this.mesh = new THREE.Group()
        this.mesh.add(new THREE.Mesh(geometry, materialFront))
        this.mesh.add(new THREE.Mesh(geometry, materialBack))
        this.mesh.position.copy(center)
        this.mesh.position.y = Math.max(center.y + 0.6, 1.6)
        this.mesh.rotation.y = angle
        this.mesh.renderOrder = 5
        this.game.scene.add(this.mesh)
    }
}
