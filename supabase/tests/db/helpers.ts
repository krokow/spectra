import { randomUUID } from 'node:crypto'
import pg from 'pg'

export const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 4 })

export type Actor =
  { id: string; username: string; email: string; password: string } | 'anon' | 'service'

export async function createUser(
  username: string,
  password = 'Motdepasse42',
): Promise<Exclude<Actor, 'anon' | 'service'>> {
  const id = randomUUID()
  const email = `${username.toLowerCase()}-${id.slice(0, 6)}@test.local`
  await pool.query(
    `insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
     values ($1, $2, extensions.crypt($3, extensions.gen_salt('bf', 4)), jsonb_build_object('username', $4::text))`,
    [id, email, password, username],
  )
  return { id, username, email, password }
}

/** Exécute `sql` dans une transaction, avec le rôle et les claims JWT de l'acteur, puis annule. */
export async function as<T extends pg.QueryResultRow = pg.QueryResultRow>(
  actor: Actor,
  sql: string,
  params: unknown[] = [],
  opts: { commit?: boolean; headers?: Record<string, string> } = {},
): Promise<T[]> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const role = actor === 'anon' ? 'anon' : actor === 'service' ? 'service_role' : 'authenticated'
    const claims = typeof actor === 'object' ? { sub: actor.id, role } : { role }
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(claims),
    ])
    await client.query(`select set_config('request.headers', $1, true)`, [
      JSON.stringify(
        opts.headers ?? {
          'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
        },
      ),
    ])
    await client.query(`set local role ${role}`)
    const res = await client.query<T>(sql, params)
    await client.query(opts.commit ? 'commit' : 'rollback')
    return res.rows
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    throw e
  } finally {
    client.release()
  }
}

/** Requête en super-utilisateur (mise en place des scénarios). */
export async function admin<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await pool.query<T>(sql, params)).rows
}

export async function befriend(
  a: { id: string },
  b: { id: string },
  status: 'pending' | 'accepted' | 'blocked' = 'accepted',
) {
  await admin(`insert into public.friendships (requester, addressee, status) values ($1, $2, $3)`, [
    a.id,
    b.id,
    status,
  ])
}
