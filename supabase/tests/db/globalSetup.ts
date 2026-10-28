import { readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'

/**
 * Démarre un Postgres jetable, applique l'imitation Supabase puis TOUTES les
 * migrations dans l'ordre, exactement comme dans le SQL Editor.
 * Si TEST_DATABASE_URL est fourni (CI sur une vraie pile Supabase), on l'utilise
 * tel quel : les migrations y ont déjà été appliquées par la CLI.
 */
export default async function setup() {
  if (process.env.TEST_DATABASE_URL) return () => undefined

  // Dossier non créé à l'avance : initdb le crée lui-même (il refuse un dossier
  // appartenant à un autre utilisateur, ce qui arrive quand on lance les tests en root).
  const dir = join(tmpdir(), `spectra-pg-${process.pid}-${Date.now()}`)
  const port = 55000 + Math.floor(Math.random() * 1000)
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => undefined,
  })
  await server.initialise()
  await server.start()

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  const root = join(import.meta.dirname, '..', '..')
  await client.query(await readFile(join(root, 'tests', 'db', 'shim.sql'), 'utf8'))
  const migrations = (await readdir(join(root, 'migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of migrations) {
    try {
      await client.query(await readFile(join(root, 'migrations', file), 'utf8'))
    } catch (e) {
      throw new Error(`Échec de la migration ${file} : ${(e as Error).message}`, { cause: e })
    }
  }
  await client.end()
  process.env.TEST_DATABASE_URL = url

  return async () => {
    await server.stop()
    await rm(dir, { recursive: true, force: true })
  }
}
