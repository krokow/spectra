// Assemble chaque Edge Function (index.ts + modules locaux importés) en UN seul
// fichier, à coller dans Supabase → Edge Functions → Deploy → Via Editor.
// Sortie : supabase/functions-bundled/<nom>.ts (versionné ; la CI vérifie qu'il est à jour).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const functionsDir = join(root, 'supabase', 'functions')
const outDir = join(root, 'supabase', 'functions-bundled')

const IMPORT_RE = /^import\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"];?[ \t]*$/gm

async function inline(file, seen, externals) {
  if (seen.has(file)) return ''
  seen.add(file)
  const source = await readFile(file, 'utf8')
  let deps = ''
  const body = source.replace(IMPORT_RE, (statement, spec) => {
    if (spec.startsWith('.')) {
      deps += `__DEP__${resolve(dirname(file), spec)}__\n`
      return ''
    }
    externals.add(statement.trim().replace(/;?$/, ''))
    return ''
  })
  let resolved = ''
  for (const line of deps.split('\n').filter(Boolean)) {
    const dep = line.slice('__DEP__'.length, -2)
    resolved += await inline(dep, seen, externals)
  }
  const rel = relative(root, file)
  return `${resolved}\n// ───── ${rel} ─────\n${body.trim()}\n`
}

const names = (await readdir(functionsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)

await mkdir(outDir, { recursive: true })
for (const name of names) {
  const externals = new Set()
  const code = await inline(join(functionsDir, name, 'index.ts'), new Set(), externals)
  const out =
    `// FICHIER GÉNÉRÉ par scripts/functions/bundle.mjs : ne pas modifier à la main.\n` +
    `// Source : supabase/functions/${name}/. Copier TOUT ce fichier dans l'éditeur Supabase.\n\n` +
    [...externals].sort().join('\n') +
    '\n' +
    code
  await writeFile(join(outDir, `${name}.ts`), out)
  console.log(`functions: ${name} → supabase/functions-bundled/${name}.ts`)
}
