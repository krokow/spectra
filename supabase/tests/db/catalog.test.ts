import { afterAll, describe, expect, it } from 'vitest'
import { admin, as, createUser, pool } from './helpers'

afterAll(() => pool.end())
const uniq = () => Math.floor(Math.random() * 1e12)

const track = (deezerId: number, patch: Record<string, unknown> = {}) => ({
  title: 'Get Lucky',
  artist: { name: 'Daft Punk', deezer_id: 27 },
  album: 'Random Access Memories',
  deezer_id: deezerId,
  rank: 900000,
  preview_url: 'https://cdnt-preview.dzcdn.net/x.mp3?hdnea=exp=1999999999~acl=x',
  preview_source: 'deezer',
  preview_expires_at: '2033-05-18T03:33:19Z',
  ...patch,
})

const upsert = (items: unknown[]) =>
  as<{ ids: string[] }>(
    'service',
    'select public.upsert_tracks($1::jsonb) as ids',
    [JSON.stringify(items)],
    { commit: true },
  ).then((r) => r[0]!.ids)

describe('catalogue', () => {
  it('la migration 0002 est tracée', async () => {
    expect(await admin(`select name from ops.schema_migrations where version = 2`)).toEqual([
      { name: 'catalog' },
    ])
  })

  it('upsert_tracks crée artiste et morceau, puis met à jour sans dupliquer', async () => {
    const id = uniq()
    const [first] = await upsert([track(id)])
    const [again] = await upsert([
      track(id, { rank: 12, cover_url: 'https://e-cdns-images.dzcdn.net/c.jpg' }),
    ])
    expect(again).toBe(first)
    const [row] = await admin<{
      rank: number
      cover_url: string
      album: string
      artist_name: string
    }>('select rank, cover_url, album, artist_name from public.tracks where id = $1', [first])
    expect(row).toEqual({
      rank: 12,
      cover_url: 'https://e-cdns-images.dzcdn.net/c.jpg',
      album: 'Random Access Memories',
      artist_name: 'Daft Punk',
    })
    const artists = await admin('select id from public.artists where deezer_id = 27')
    expect(artists).toHaveLength(1)
  })

  it('un artiste sans identifiant Deezer est retrouvé par son nom (iTunes)', async () => {
    const name = `Artiste ${uniq()}`
    const [a, b] = await upsert([
      { title: 'Un', artist: { name }, itunes_id: uniq(), preview_source: 'itunes' },
      {
        title: 'Deux',
        artist: { name: name.toUpperCase() },
        itunes_id: uniq(),
        preview_source: 'itunes',
      },
    ])
    const rows = await admin<{ artist_id: string }>(
      'select artist_id from public.tracks where id = any($1::uuid[])',
      [[a, b]],
    )
    expect(new Set(rows.map((r) => r.artist_id)).size).toBe(1)
  })

  it('refuse plus de 100 morceaux d’un coup', async () => {
    await expect(upsert(Array.from({ length: 101 }, (_, i) => track(i + 1)))).rejects.toThrow(
      /100 éléments/,
    )
  })

  it('un morceau doit avoir une source (Deezer ou iTunes)', async () => {
    await expect(upsert([{ title: 'Orphelin', artist: { name: 'X' } }])).rejects.toThrow(
      /track_has_source/,
    )
  })

  it('lecture réservée aux connectés, écriture réservée au serveur', async () => {
    const [id] = await upsert([track(uniq())])
    const u = await createUser(`cat_${uniq().toString(36)}`)
    expect(await as(u, 'select title from public.tracks where id = $1', [id])).toEqual([
      { title: 'Get Lucky' },
    ])
    await expect(as('anon', 'select * from public.tracks')).rejects.toThrow(/permission denied/)
    await expect(as(u, `update public.tracks set title = 'x' where id = $1`, [id])).rejects.toThrow(
      /permission denied/,
    )
    await expect(as(u, `insert into public.artists (name) values ('pirate')`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(as(u, `select public.upsert_tracks('[]'::jsonb)`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(as(u, 'select * from public.search_cache')).rejects.toThrow(/permission denied/)
  })

  it('les ancres désactivées sont invisibles', async () => {
    const [on, off] = await upsert([track(uniq()), track(uniq())])
    await admin(
      `insert into public.anchor_tracks (track_id, cell, active) values ($1, 'a', true), ($2, 'b', false)`,
      [on, off],
    )
    const u = await createUser(`anc_${uniq().toString(36)}`)
    const rows = await as<{ track_id: string }>(
      u,
      'select track_id from public.anchor_tracks where track_id = any($1::uuid[])',
      [[on, off]],
    )
    expect(rows).toEqual([{ track_id: on }])
  })

  it('les caractéristiques restent dans [0, 1]', async () => {
    const [id] = await upsert([track(uniq())])
    const dims =
      'energy, valence, acoustic, tempo, dance, complexity, vocal, bass, polish, warmth, era, niche'
    await expect(
      admin(
        `insert into public.track_features (track_id, ${dims}, source) values ($1, 1.2, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5, .5, 'curated')`,
        [id],
      ),
    ).rejects.toThrow(/check constraint/)
  })

  it('edge_rate_limit bloque au-delà de la limite et n’est pas appelable par un utilisateur', async () => {
    const key = `test-${uniq()}`
    for (let i = 0; i < 3; i++)
      await as('service', 'select public.edge_rate_limit($1, 3, 60)', [key], { commit: true })
    await expect(as('service', 'select public.edge_rate_limit($1, 3, 60)', [key])).rejects.toThrow(
      /Trop de tentatives/,
    )
    const u = await createUser(`rl_${uniq().toString(36)}`)
    await expect(as(u, `select public.edge_rate_limit('x', 1, 60)`)).rejects.toThrow(
      /permission denied/,
    )
  })
})
