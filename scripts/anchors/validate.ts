// Vérifie la source de la bibliothèque d'ancrage (sans réseau) : format, couverture.
// Usage : npm run anchors:validate   (code de sortie 1 en cas d'erreur)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { coverage, parseCsv, RULES } from './lib.ts'

const file = join(
  import.meta.dirname,
  '..',
  '..',
  'supabase',
  'seed',
  'anchors',
  'anchors.source.csv',
)
const { rows, errors: parseErrors } = parseCsv(readFileSync(file, 'utf8'))
const { errors, warnings, stats } = coverage(rows)

console.log(
  `Bibliothèque d'ancrage : ${stats.total} morceaux, ${Object.keys(stats.languages).length - 1} langues chantées.`,
)
console.log(
  'Par genre (poids ≥ 0.5) :',
  Object.entries(stats.perGenre)
    .map(([g, n]) => `${g} ${n}`)
    .join(' · '),
)
console.log(
  'Par décennie :',
  Object.entries(stats.perDecade)
    .sort()
    .map(([d, n]) => `${d} ${n}`)
    .join(' · '),
)
for (const [d, b] of Object.entries(stats.perBucket))
  console.log(`  ${d.padEnd(10)} ${b.map((n) => String(n).padStart(4)).join(' ')}`)
console.log(
  `Règles : ≥${RULES.minPerGenre}/genre, ≥${RULES.minPerDecade}/décennie, ≥${RULES.minPerBucket}/cinquième, ≤${RULES.maxPerArtist}/artiste, ≥${RULES.minLanguages} langues.`,
)

for (const w of warnings) console.warn(`⚠ ${w}`)
const all = [...parseErrors, ...errors]
for (const e of all) console.error(`✗ ${e}`)
if (all.length > 0) process.exit(1)
console.log('✓ Couverture conforme.')
