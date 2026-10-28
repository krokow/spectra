import { assert, assertEquals } from 'jsr:@std/assert@1.0.13'
import {
  MusicRequest,
  normalizeDeezer,
  normalizeQuery,
  normalizeTags,
  parseDeezerList,
  parseItunesList,
  previewExpiry,
  sameTrack,
} from './lib.ts'

const NOW = Date.parse('2026-10-28T12:00:00Z')

Deno.test('validation des requêtes', () => {
  assert(MusicRequest.safeParse({ action: 'search', q: 'daft punk' }).success)
  assert(!MusicRequest.safeParse({ action: 'search', q: '' }).success)
  assert(!MusicRequest.safeParse({ action: 'search', q: 'x'.repeat(101) }).success)
  assert(!MusicRequest.safeParse({ action: 'preview', trackId: 'pas-un-uuid' }).success)
  assert(!MusicRequest.safeParse({ action: 'drop table' }).success)
})

Deno.test('clé de cache de recherche', () => {
  assertEquals(normalizeQuery('  Beyoncé   HALO '), 'beyonce halo')
})

Deno.test("échéance d'un extrait Deezer signé", () => {
  const url =
    'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/x.mp3?hdnea=exp=1793232000~acl=/api/1/1/a*~data=user_id=0~hmac=ab'
  assertEquals(previewExpiry(url, NOW), new Date(1793232000 * 1000).toISOString())
  // Sans échéance lisible : 1 h par prudence.
  assertEquals(previewExpiry('https://x/y.mp3', NOW), new Date(NOW + 3600_000).toISOString())
  assertEquals(previewExpiry(undefined), undefined)
})

Deno.test('normalisation Deezer', () => {
  const t = normalizeDeezer(
    {
      id: 67238735,
      title: 'Get Lucky',
      duration: 369,
      rank: 870000,
      explicit_lyrics: false,
      preview: 'https://cdnt-preview.dzcdn.net/x.mp3?hdnea=exp=1793232000~acl=x',
      bpm: 0,
      artist: {
        id: 27,
        name: 'Daft Punk',
        picture_medium: 'https://e-cdns-images.dzcdn.net/a.jpg',
      },
      album: {
        id: 6575789,
        title: 'Random Access Memories',
        cover_xl: 'https://e-cdns-images.dzcdn.net/c.jpg',
        release_date: '2013-05-17',
      },
    },
    NOW,
  )
  assertEquals(t.deezer_id, 67238735)
  assertEquals(t.artist, {
    name: 'Daft Punk',
    deezer_id: 27,
    image_url: 'https://e-cdns-images.dzcdn.net/a.jpg',
  })
  assertEquals(t.release_year, 2013)
  assertEquals(t.preview_source, 'deezer')
  assertEquals(t.bpm, undefined, 'bpm = 0 signifie inconnu')
  assertEquals(t.cover_url, 'https://e-cdns-images.dzcdn.net/c.jpg')
})

Deno.test('les éléments Deezer invalides ou indisponibles sont ignorés', () => {
  const list = parseDeezerList([
    { id: 1, title: 'ok', artist: { id: 2, name: 'A' } },
    { id: 'pas un nombre', title: 'ko' },
    { id: 3, title: 'indispo', readable: false, artist: { id: 2, name: 'A' } },
    { id: 4, title: 'http', preview: 'http://insecure/x.mp3', artist: { id: 2, name: 'A' } },
  ])
  assertEquals(
    list.map((t) => t.title),
    ['ok', 'http'],
  )
  assertEquals(list[1]?.preview_url, undefined, 'un extrait non HTTPS est refusé (CSP)')
})

Deno.test('normalisation iTunes', () => {
  const [t] = parseItunesList([
    {
      kind: 'song',
      trackId: 617154366,
      trackName: 'Get Lucky (feat. Pharrell Williams)',
      artistName: 'Daft Punk',
      artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg',
      previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a',
      releaseDate: '2013-04-19T07:00:00Z',
      trackTimeMillis: 369000,
    },
    { kind: 'music-video', trackId: 1, trackName: 'clip', artistName: 'x' },
  ])
  assertEquals(t?.itunes_id, 617154366)
  assertEquals(t?.cover_url, 'https://is1-ssl.mzstatic.com/a/600x600bb.jpg')
  assertEquals(t?.duration_s, 369)
  assertEquals(t?.preview_source, 'itunes')
})

Deno.test('correspondance de morceaux tolérante', () => {
  assert(
    sameTrack(
      { title: 'Get Lucky (feat. Pharrell Williams)', artist: 'Daft Punk' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    ),
  )
  assert(
    sameTrack(
      { title: 'Déjà vu', artist: 'Beyoncé' },
      { title: 'Deja Vu', artist: 'Beyonce feat. Jay-Z' },
    ),
  )
  assert(
    !sameTrack(
      { title: 'Get Lucky', artist: 'Daft Punk' },
      { title: 'One More Time', artist: 'Daft Punk' },
    ),
  )
})

Deno.test('tags Last.fm', () => {
  assertEquals(
    normalizeTags({
      toptags: {
        tag: [
          { name: ' Disco ', count: 100 },
          { name: 'funk', count: '55' },
          { name: 'zero', count: 0 },
        ],
      },
    }),
    [
      { name: 'disco', count: 100 },
      { name: 'funk', count: 55 },
    ],
  )
  assertEquals(normalizeTags({ toptags: { tag: { name: 'solo', count: 10 } } }), [
    { name: 'solo', count: 10 },
  ])
  assertEquals(normalizeTags({ error: 6, message: 'Track not found' }), [])
})
