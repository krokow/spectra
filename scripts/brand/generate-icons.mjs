// Génère toutes les icônes PWA depuis design/brand/*.svg (aucune icône écrite à la main).
// Sortie : public/icons/ (ignoré par git, régénéré à chaque dev/build).
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const brand = join(root, 'design', 'brand')
const out = join(root, 'public', 'icons')

const icon = join(brand, 'spectra-logo-icon.svg')
const maskable = join(brand, 'spectra-logo-icon-maskable.svg')

const targets = [
  { src: icon, file: 'pwa-192.png', size: 192 },
  { src: icon, file: 'pwa-512.png', size: 512 },
  { src: maskable, file: 'maskable-512.png', size: 512 },
  { src: maskable, file: 'maskable-192.png', size: 192 },
  // iOS n'applique pas de masque arrondi transparent : on part du fond plein cadre.
  { src: maskable, file: 'apple-touch-icon-180.png', size: 180 },
  { src: icon, file: 'favicon-32.png', size: 32 },
  { src: icon, file: 'favicon-16.png', size: 16 },
]

async function isFresh(file, sources) {
  try {
    const t = (await stat(file)).mtimeMs
    for (const s of sources) if ((await stat(s)).mtimeMs > t) return false
    return true
  } catch {
    return false
  }
}

await mkdir(out, { recursive: true })
const stamp = join(out, '.stamp')
if (
  process.argv.includes('--force') ||
  !(await isFresh(stamp, [icon, maskable, fileURLToPath(import.meta.url)]))
) {
  await Promise.all(
    targets.map(({ src, file, size }) =>
      sharp(src, { density: Math.max(72, Math.ceil((72 * size) / 512) * 4) })
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(join(out, file)),
    ),
  )
  await copyFile(icon, join(out, 'favicon.svg'))
  // Image de partage (Open Graph) : icône centrée sur fond nuit.
  const og = await sharp(await readFile(icon), { density: 288 })
    .resize(420, 420)
    .png()
    .toBuffer()
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#0B0A14' } })
    .composite([{ input: og, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(join(out, 'og-image.png'))
  await writeFile(stamp, new Date().toISOString())
  console.log(`icons: ${targets.length + 2} fichiers générés dans public/icons`)
} else {
  console.log('icons: à jour')
}
