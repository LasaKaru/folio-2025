/**
 * Retints the shared model palette (static/palette.png) toward the
 * "Neon Havoc" look: hue rotated toward pinks/purples, saturation boosted.
 *
 * Usage: node scripts/retheme-palette.js [input] [output]
 * Note: after running this, run `npm run compress` (requires toktx) to
 * regenerate static/palette.ktx used by compressed builds.
 */
import sharp from 'sharp'

const input = process.argv[2] || 'static/palette.png'
const output = process.argv[3] || 'static/palette.png'

const HUE_ROTATION = -50 // degrees
const SATURATION = 1.3
const BRIGHTNESS = 1.0

const buffer = await sharp(input)
    .modulate({ hue: HUE_ROTATION, saturation: SATURATION, brightness: BRIGHTNESS })
    .png()
    .toBuffer()

await sharp(buffer).toFile(output)

console.log(`Palette rethemed: ${input} -> ${output} (hue ${HUE_ROTATION}deg, saturation x${SATURATION})`)
