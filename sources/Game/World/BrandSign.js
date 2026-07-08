import { Game } from '../Game.js'

/**
 * The landing area's "BRUNO SIMON" lettering is baked directly into
 * areas.glb (10 static meshes named refLetters010-019) and can't be edited
 * without Blender. This just hides that lettering -- no replacement sign.
 */
export class BrandSign
{
    constructor()
    {
        this.game = Game.getInstance()
        this.hide()
    }

    hide()
    {
        this.game.scene.traverse((child) =>
        {
            if(child.isMesh && child.name.startsWith('refLetters'))
                child.visible = false
        })
    }
}
