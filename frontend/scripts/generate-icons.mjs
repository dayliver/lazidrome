import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const svgPath = join(publicDir, 'app-icon.svg')
const svg = readFileSync(svgPath, 'utf8')

/** @param {number} size @param {string} filename */
function writePng(size, filename) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  const rendered = resvg.render()
  const out = join(publicDir, filename)
  writeFileSync(out, rendered.asPng())
  console.log(`✓ ${filename} (${size}×${size})`)
}

const targets = [
  [192, 'pwa-192.png'],
  [512, 'pwa-512.png'],
  [180, 'apple-touch-icon.png'],
]

for (const [size, name] of targets) {
  writePng(size, name)
}
