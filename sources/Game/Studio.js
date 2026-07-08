// HelaO2 Studio splash. Shown for a moment before the game boots,
// purely cosmetic — never blocks loading, which continues underneath.
export class Studio
{
    constructor()
    {
        this.element = document.querySelector('.js-studio-splash')

        if(!this.element)
            return

        const skip = localStorage.getItem('neonHavoc.skipStudioSplash') === 'true'
        const duration = skip ? 0 : 1700

        setTimeout(() =>
        {
            this.hide()
        }, duration)
    }

    hide()
    {
        if(!this.element)
            return

        this.element.classList.add('is-hidden')
        localStorage.setItem('neonHavoc.skipStudioSplash', 'true')

        setTimeout(() =>
        {
            this.element?.remove()
            this.element = null
        }, 600)
    }
}
