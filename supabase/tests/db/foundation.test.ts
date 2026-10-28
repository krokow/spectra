import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, as, befriend, createUser, pool } from './helpers'

type User = Awaited<ReturnType<typeof createUser>>
const uniq = () => Math.random().toString(36).slice(2, 8)

afterAll(() => pool.end())

describe('garde-fous globaux', () => {
  it('la RLS est activée sur CHAQUE table du schéma public', async () => {
    const rows = await admin<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(rows).toEqual([])
  })

  it('le rôle anon ne peut lire aucune table du schéma public', async () => {
    const rows = await admin<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'PUBLIC')`,
    )
    expect(rows).toEqual([])
  })

  it('le schéma privé ops est inaccessible depuis l’API', async () => {
    const u = await createUser(`ops_${uniq()}`)
    await expect(as(u, 'select * from ops.schema_migrations')).rejects.toThrow(/permission denied/)
    await expect(as('anon', 'select * from ops.rate_limits')).rejects.toThrow(/permission denied/)
  })

  it('la migration est tracée', async () => {
    const rows = await admin(`select version, name from ops.schema_migrations where version = 1`)
    expect(rows).toEqual([{ version: 1, name: 'foundation' }])
  })
})

describe('inscription et pseudos', () => {
  it('crée la carte de profil et les réglages par défaut', async () => {
    const u = await createUser(`Neo_${uniq()}`)
    const [p] = await admin(`select username, display_name from public.profiles where id = $1`, [
      u.id,
    ])
    expect(p).toEqual({ username: u.username, display_name: null })
    const [s] = await admin(
      `select locale, profile_visibility, stats_visibility, searchable, twins_opt_in
                             from public.profile_settings where user_id = $1`,
      [u.id],
    )
    expect(s).toEqual({
      locale: 'fr',
      profile_visibility: 'friends',
      stats_visibility: 'friends',
      searchable: true,
      twins_opt_in: false,
    })
  })

  it.each([
    ['trop court', 'ab'],
    ['caractères interdits', 'jean dupont'],
    ['réservé', 'Admin'],
  ])('refuse un pseudo %s', async (_cas, name) => {
    await expect(createUser(name)).rejects.toThrow(/Pseudo invalide/)
  })

  it('refuse un pseudo déjà pris, sans tenir compte de la casse', async () => {
    const name = `Trinity_${uniq()}`
    await createUser(name)
    await expect(createUser(name.toUpperCase())).rejects.toThrow(/Pseudo invalide \(taken\)/)
  })

  it('username_available répond aux visiteurs non connectés', async () => {
    const taken = await createUser(`Morph_${uniq()}`)
    const check = async (name: string) =>
      (await as<{ ok: boolean }>('anon', 'select public.username_available($1) as ok', [name]))[0]
        ?.ok
    expect(await check(`libre_${uniq()}`)).toBe(true)
    expect(await check(taken.username.toLowerCase())).toBe(false)
    expect(await check('support')).toBe(false)
    expect(await check('x')).toBe(false)
  })

  it('username_available est limité à 60 appels par minute et par IP', async () => {
    const headers = { 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250)}` }
    for (let i = 0; i < 60; i++) {
      await as('anon', 'select public.username_available($1)', ['quelquun'], {
        headers,
        commit: true,
      })
    }
    await expect(
      as('anon', 'select public.username_available($1)', ['quelquun'], { headers }),
    ).rejects.toThrow(/Trop de tentatives/)
  })
})

describe('visibilité des profils', () => {
  let alice: User, bob: User, carol: User, dave: User, eve: User

  beforeAll(async () => {
    alice = await createUser(`alice_${uniq()}`) // amis par défaut
    bob = await createUser(`bob_${uniq()}`) // ami accepté d'alice
    carol = await createUser(`carol_${uniq()}`) // demande en attente avec alice
    dave = await createUser(`dave_${uniq()}`) // inconnu
    eve = await createUser(`eve_${uniq()}`) // profil public, mais a bloqué dave
    await befriend(alice, bob, 'accepted')
    await befriend(carol, alice, 'pending')
    await admin(
      `update public.profile_settings set profile_visibility = 'public' where user_id = $1`,
      [eve.id],
    )
    await befriend(eve, dave, 'blocked')
  })

  const sees = async (viewer: User, target: User) =>
    (await as(viewer, 'select id from public.profiles where id = $1', [target.id])).length === 1

  it('chacun voit sa propre carte', async () => {
    expect(await sees(dave, dave)).toBe(true)
  })

  it('profil « amis » : visible des amis acceptés, invisible des inconnus', async () => {
    expect(await sees(bob, alice)).toBe(true)
    expect(await sees(dave, alice)).toBe(false)
  })

  it('une demande en attente rend les deux cartes visibles l’une à l’autre', async () => {
    expect(await sees(carol, alice)).toBe(true)
    expect(await sees(alice, carol)).toBe(true)
  })

  it('profil public : visible de tous les connectés, sauf de la personne bloquée', async () => {
    expect(await sees(bob, eve)).toBe(true)
    expect(await sees(dave, eve)).toBe(false)
  })

  it('profil privé : invisible même des amis', async () => {
    await admin(
      `update public.profile_settings set profile_visibility = 'private' where user_id = $1`,
      [bob.id],
    )
    expect(await sees(alice, bob)).toBe(false)
    await admin(
      `update public.profile_settings set profile_visibility = 'friends' where user_id = $1`,
      [bob.id],
    )
  })

  it('un visiteur non connecté ne lit aucune carte', async () => {
    await expect(as('anon', 'select * from public.profiles')).rejects.toThrow(/permission denied/)
  })

  it('les réglages ne sont lisibles que par leur propriétaire', async () => {
    expect(
      await as(bob, 'select * from public.profile_settings where user_id = $1', [alice.id]),
    ).toEqual([])
    expect(await as(alice, 'select user_id from public.profile_settings')).toEqual([
      { user_id: alice.id },
    ])
  })

  it('fonctions de visibilité des stats et de l’activité', async () => {
    const [r] = await as<{ friend: boolean; stranger: boolean }>(
      bob,
      'select public.can_view_stats($1) as friend, public.can_view_activity($2) as stranger',
      [alice.id, dave.id],
    )
    expect(r).toEqual({ friend: true, stranger: false })
  })
})

describe('modifications', () => {
  let alice: User, bob: User
  beforeAll(async () => {
    alice = await createUser(`malice_${uniq()}`)
    bob = await createUser(`mbob_${uniq()}`)
    await befriend(alice, bob)
  })

  it('je peux modifier mon nom affiché et mes réglages', async () => {
    const rows = await as(
      alice,
      `update public.profiles set display_name = 'Alice' where id = $1 returning display_name`,
      [alice.id],
    )
    expect(rows).toEqual([{ display_name: 'Alice' }])
    const s = await as(
      alice,
      `update public.profile_settings set stats_visibility = 'private', locale = 'en'
                               where user_id = $1 returning stats_visibility, locale`,
      [alice.id],
    )
    expect(s).toEqual([{ stats_visibility: 'private', locale: 'en' }])
  })

  it('je ne peux pas modifier le profil ni les réglages d’un autre (0 ligne touchée)', async () => {
    expect(
      await as(
        alice,
        `update public.profiles set display_name = 'pirate' where id = $1 returning id`,
        [bob.id],
      ),
    ).toEqual([])
    expect(
      await as(
        alice,
        `update public.profile_settings set searchable = false where user_id = $1 returning user_id`,
        [bob.id],
      ),
    ).toEqual([])
  })

  it('les colonnes non prévues ne sont pas modifiables', async () => {
    await expect(
      as(alice, `update public.profiles set created_at = now() where id = $1`, [alice.id]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(alice, `update public.profile_settings set user_id = $1 where user_id = $1`, [alice.id]),
    ).rejects.toThrow(/permission denied/)
  })

  it('personne ne crée ni ne supprime de profil directement', async () => {
    await expect(
      as(
        alice,
        `insert into public.profiles (id, username) values (gen_random_uuid(), 'fake_user')`,
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(alice, `delete from public.profiles where id = $1`, [alice.id]),
    ).rejects.toThrow(/permission denied/)
  })

  it('un changement de pseudo respecte les mêmes règles', async () => {
    await expect(
      as(alice, `update public.profiles set username = 'admin' where id = $1`, [alice.id]),
    ).rejects.toThrow(/réservé/)
    await expect(
      as(alice, `update public.profiles set username = 'a b' where id = $1`, [alice.id]),
    ).rejects.toThrow(/username_format/)
    await expect(
      as(alice, `update public.profiles set username = $2 where id = $1`, [
        alice.id,
        bob.username.toUpperCase(),
      ]),
    ).rejects.toThrow(/profiles_username_key/)
  })
})

describe('amitiés (lecture seule à ce stade)', () => {
  let a: User, b: User, c: User
  beforeAll(async () => {
    a = await createUser(`fa_${uniq()}`)
    b = await createUser(`fb_${uniq()}`)
    c = await createUser(`fc_${uniq()}`)
    await befriend(a, b, 'blocked') // a bloque b
  })

  it('le blocage n’est visible que par la personne qui bloque', async () => {
    expect(await as(a, 'select status from public.friendships')).toEqual([{ status: 'blocked' }])
    expect(await as(b, 'select status from public.friendships')).toEqual([])
    expect(await as(c, 'select status from public.friendships')).toEqual([])
  })

  it('aucune écriture directe (passera par des RPC à l’étape 7)', async () => {
    await expect(
      as(c, `insert into public.friendships (requester, addressee) values ($1, $2)`, [c.id, a.id]),
    ).rejects.toThrow(/permission denied/)
    await expect(as(a, `delete from public.friendships`)).rejects.toThrow(/permission denied/)
  })
})

describe('administrateurs', () => {
  it('app_admins est illisible et is_admin() répond correctement', async () => {
    const u = await createUser(`adm_${uniq()}`)
    await expect(as(u, 'select * from public.app_admins')).rejects.toThrow(/permission denied/)
    expect((await as<{ v: boolean }>(u, 'select public.is_admin() as v'))[0]?.v).toBe(false)
    await admin('insert into public.app_admins (user_id) values ($1)', [u.id])
    expect((await as<{ v: boolean }>(u, 'select public.is_admin() as v'))[0]?.v).toBe(true)
    await expect(
      as(u, 'insert into public.app_admins (user_id) values (gen_random_uuid())'),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('connexion par pseudo', () => {
  let u: User
  beforeAll(async () => {
    u = await createUser(`login_${uniq()}`, 'BonMotDePasse9')
  })
  const lookup = (name: string, pw: string, headers?: Record<string, string>) =>
    as<{ email: string | null }>(
      'anon',
      'select public.login_email_for($1, $2) as email',
      [name, pw],
      {
        commit: true,
        ...(headers ? { headers } : {}),
      },
    ).then((r) => r[0]?.email)

  it('renvoie l’e-mail seulement avec le bon mot de passe', async () => {
    expect(await lookup(u.username.toUpperCase(), 'BonMotDePasse9')).toBe(u.email)
    expect(await lookup(u.username, 'mauvais')).toBeNull()
    expect(await lookup(`inconnu_${uniq()}`, 'BonMotDePasse9')).toBeNull()
  })

  it('n’est pas appelable par un utilisateur connecté (inutile, donc fermé)', async () => {
    await expect(as(u, `select public.login_email_for('x', 'y')`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('bloque après 10 essais sur le même pseudo en 15 minutes', async () => {
    const target = await createUser(`brute_${uniq()}`)
    for (let i = 0; i < 10; i++) await lookup(target.username, `essai${i}`)
    await expect(lookup(target.username, 'encore')).rejects.toThrow(/Trop de tentatives/)
  })
})

describe('codes de secours', () => {
  it('génère 8 codes uniques, stockés hachés, illisibles par l’API', async () => {
    const u = await createUser(`rc_${uniq()}`)
    const [r] = await as<{ codes: string[] }>(
      u,
      'select public.generate_recovery_codes() as codes',
      [],
      { commit: true },
    )
    const codes = r!.codes
    expect(codes).toHaveLength(8)
    expect(new Set(codes).size).toBe(8)
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    const stored = await admin<{ code_hash: string }>(
      'select code_hash from public.recovery_codes where user_id = $1',
      [u.id],
    )
    expect(
      stored.every((s) => s.code_hash.startsWith('$2a$') && !codes.includes(s.code_hash)),
    ).toBe(true)
    await expect(as(u, 'select * from public.recovery_codes')).rejects.toThrow(/permission denied/)
    expect(
      (await as<{ n: number }>(u, 'select public.recovery_codes_remaining() as n'))[0]?.n,
    ).toBe(8)
  })

  it('un code valide est trouvé par e-mail ou pseudo, puis ne sert qu’une fois', async () => {
    const u = await createUser(`rc2_${uniq()}`)
    const [r] = await as<{ codes: string[] }>(
      u,
      'select public.generate_recovery_codes() as codes',
      [],
      { commit: true },
    )
    const code = r!.codes[0]!
    const find = (id: string, c: string) =>
      as<{ user_id: string; code_id: number }>(
        'service',
        'select * from public.find_recovery_code($1, $2, $3)',
        [id, c, '198.51.100.1'],
        { commit: true },
      )

    const byName = await find(u.username, code.toLowerCase())
    expect(byName).toHaveLength(1)
    expect(byName[0]!.user_id).toBe(u.id)
    expect(await find(u.email.toUpperCase(), code)).toHaveLength(1)
    expect(await find(u.username, 'AAAA-AAAA')).toEqual([])

    await as('service', 'select public.consume_recovery_code($1)', [byName[0]!.code_id], {
      commit: true,
    })
    expect(await find(u.username, code)).toEqual([])
    await expect(
      as('service', 'select public.consume_recovery_code($1)', [byName[0]!.code_id]),
    ).rejects.toThrow(/déjà utilisé/)
  })

  it('régénérer invalide les anciens codes', async () => {
    const u = await createUser(`rc3_${uniq()}`)
    const [first] = await as<{ codes: string[] }>(
      u,
      'select public.generate_recovery_codes() as codes',
      [],
      { commit: true },
    )
    await as(u, 'select public.generate_recovery_codes()', [], { commit: true })
    const found = await as('service', 'select * from public.find_recovery_code($1, $2, $3)', [
      u.username,
      first!.codes[0],
      'x',
    ])
    expect(found).toEqual([])
  })

  it('les fonctions de récupération sont réservées au serveur', async () => {
    const u = await createUser(`rc4_${uniq()}`)
    await expect(as(u, `select * from public.find_recovery_code('a', 'b', 'c')`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(as('anon', `select public.consume_recovery_code(1)`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(as('anon', `select public.generate_recovery_codes()`)).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('RGPD', () => {
  it('export_my_data ne contient que mes données', async () => {
    const me = await createUser(`exp_${uniq()}`)
    const other = await createUser(`exo_${uniq()}`)
    await befriend(me, other)
    const [r] = await as<{ d: Record<string, unknown> }>(me, 'select public.export_my_data() as d')
    const d = r!.d as {
      account: { email: string }
      profile: { id: string }
      friendships: unknown[]
    }
    expect(d.account.email).toBe(me.email)
    expect(d.profile.id).toBe(me.id)
    expect(d.friendships).toHaveLength(1)
    expect(JSON.stringify(d)).not.toContain(other.email)
    await expect(as('anon', 'select public.export_my_data()')).rejects.toThrow(/permission denied/)
  })

  it('delete_my_account exige le pseudo exact puis efface tout en cascade', async () => {
    const me = await createUser(`del_${uniq()}`)
    await as(me, 'select public.generate_recovery_codes()', [], { commit: true })
    await expect(as(me, `select public.delete_my_account('pas_moi')`)).rejects.toThrow(
      /ne correspond pas/,
    )
    await as(me, 'select public.delete_my_account($1)', [me.username.toUpperCase()], {
      commit: true,
    })
    for (const [table, col] of [
      ['auth.users', 'id'],
      ['public.profiles', 'id'],
      ['public.profile_settings', 'user_id'],
      ['public.recovery_codes', 'user_id'],
    ] as const) {
      expect(await admin(`select 1 from ${table} where ${col} = $1`, [me.id])).toEqual([])
    }
  })
})
