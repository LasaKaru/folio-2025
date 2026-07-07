import * as THREE from 'three/webgpu'
import { Cycles } from './Cycles.js'

// Color themes
// "neon" is the Neon Havoc look (hot pinks, electric blues, vice sunsets)
// "classic" is the original look, kept as an option
const themes = {
    neon: {
        day:   { revealColor: '#ff7ad9', revealIntensity: 10,   electricField: 0,    temperature: 5,    lightColor: '#ffb68f', lightIntensity: 1.25, shadowColor: '#8b2bd9', fogColorA: '#2fe3e3', fogColorB: '#b06bff', fogNearRatio: 0.315, fogFarRatio: 1.25 },
        dusk:  { revealColor: '#ff5ad0', revealIntensity: 6,    electricField: 0.5,  temperature: 0,    lightColor: '#ff7a6b', lightIntensity: 1.3,  shadowColor: '#5c00c9', fogColorA: '#3d2bff', fogColorB: '#ff3ea5', fogNearRatio: 0,     fogFarRatio: 1.25 },
        night: { revealColor: '#00e5ff', revealIntensity: 12,   electricField: 1,    temperature: -7.5, lightColor: '#3d5bff', lightIntensity: 4.2,  shadowColor: '#1500b8', fogColorA: '#0b1c66', fogColorB: '#55008f', fogNearRatio: -0.85, fogFarRatio: 1 },
        dawn:  { revealColor: '#7affe9', revealIntensity: 6,    electricField: 0.25, temperature: 0,    lightColor: '#ff9e7a', lightIntensity: 1.25, shadowColor: '#c9008f', fogColorA: '#ff7ae0', fogColorB: '#ff8c3a', fogNearRatio: 0.3,   fogFarRatio: 1.25 },
    },
    classic: {
        day:   { revealColor: '#5f7dff', revealIntensity: 12,   electricField: 0,    temperature: 5,    lightColor: '#ffd2c2', lightIntensity: 1.2,  shadowColor: '#6d3fff', fogColorA: '#00ffff', fogColorB: '#9b89ff', fogNearRatio: 0.315, fogFarRatio: 1.25 },
        dusk:  { revealColor: '#ff86d9', revealIntensity: 5.55, electricField: 0.25, temperature: 0,    lightColor: '#ff8181', lightIntensity: 1.2,  shadowColor: '#4e009c', fogColorA: '#3e53ff', fogColorB: '#ff4ce4', fogNearRatio: 0,     fogFarRatio: 1.25 },
        night: { revealColor: '#b678ff', revealIntensity: 10,   electricField: 1,    temperature: -7.5, lightColor: '#3240ff', lightIntensity: 3.8,  shadowColor: '#2f00db', fogColorA: '#10266f', fogColorB: '#490a42', fogNearRatio: -0.85, fogFarRatio: 1 },
        dawn:  { revealColor: '#ff9d9d', revealIntensity: 4.85, electricField: 0.25, temperature: 0,    lightColor: '#ffa882', lightIntensity: 1.2,  shadowColor: '#db004f', fogColorA: '#f885ff', fogColorB: '#ff7d24', fogNearRatio: 0.3,   fogFarRatio: 1.25 },
    }
}

const defaultTheme = localStorage.getItem('neonHavoc.theme') === 'classic' ? 'classic' : 'neon'

// Live presets (mutated in place when the theme changes so the
// cycle keyframes, which reference these objects, pick it up)
const presets = {}

for(const presetKey in themes.neon)
{
    const source = themes[defaultTheme][presetKey]
    presets[presetKey] = {
        ...source,
        revealColor: new THREE.Color(source.revealColor),
        lightColor: new THREE.Color(source.lightColor),
        shadowColor: new THREE.Color(source.shadowColor),
        fogColorA: new THREE.Color(source.fogColorA),
        fogColorB: new THREE.Color(source.fogColorB),
    }
}

export class DayCycles extends Cycles
{
    constructor()
    {
        const forcedProgress = import.meta.env.VITE_DAY_CYCLE_PROGRESS ? parseFloat(import.meta.env.VITE_DAY_CYCLE_PROGRESS) : null
        super('🕜 Day Cycles', 4 * 60, forcedProgress, false)

        this.theme = defaultTheme
    }

    get presets()
    {
        return presets
    }

    applyTheme(themeName)
    {
        const theme = themes[themeName]

        if(!theme)
            return

        this.theme = themeName
        localStorage.setItem('neonHavoc.theme', themeName)

        for(const presetKey in theme)
        {
            const source = theme[presetKey]
            const target = presets[presetKey]

            target.revealColor.set(source.revealColor)
            target.lightColor.set(source.lightColor)
            target.shadowColor.set(source.shadowColor)
            target.fogColorA.set(source.fogColorA)
            target.fogColorB.set(source.fogColorB)
            target.revealIntensity = source.revealIntensity
            target.electricField = source.electricField
            target.temperature = source.temperature
            target.lightIntensity = source.lightIntensity
            target.fogNearRatio = source.fogNearRatio
            target.fogFarRatio = source.fogFarRatio
        }
    }

    getKeyframesDescriptions()
    {
        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(this, 'duration', { min: 1, max: 60 * 10, step: 1 })

            for(const presetKey in presets)
            {
                const preset = presets[presetKey]
                const presetsDebugPanel = this.debugPanel.addFolder({
                    title: presetKey,
                    expanded: true,
                })

                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.revealColor, 'revealColor')
                presetsDebugPanel.addBinding(preset, 'revealIntensity', { min: 0, max: 20, step: 0.001 })
                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.lightColor, 'lightColor')
                presetsDebugPanel.addBinding(preset, 'lightIntensity', { min: 0, max: 20 })
                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.shadowColor, 'shadowColor')
                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.fogColorA, 'fogColorA')
                this.game.debug.addThreeColorBinding(presetsDebugPanel, preset.fogColorB, 'fogColorB')
                presetsDebugPanel.addBinding(preset, 'fogNearRatio', { label: 'near', min: -2, max: 2, step: 0.001 })
                presetsDebugPanel.addBinding(preset, 'fogFarRatio', { label: 'far', min: -2, max: 2, step: 0.001 })
            }
        }

        return [
            [
                { properties: presets.day, stop: 0.0 }, // day
                { properties: presets.day, stop: 0.15 }, // day
                { properties: presets.dusk, stop: 0.25 }, // Dusk
                { properties: presets.night, stop: 0.35 }, // Night
                { properties: presets.night, stop: 0.6 }, // Night
                { properties: presets.dawn, stop: 0.8 }, // Dawn
                { properties: presets.day, stop: 0.9 }, // day
            ]
        ]
    }

    getIntervalDescriptions()
    {
        return [
            { name: 'night', start: 0.25, end: 0.7 },
            { name: 'deepNight', start: 0.35, end: 0.6 },
        ]
    }
}
