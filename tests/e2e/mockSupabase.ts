import type { Page, Route } from '@playwright/test'

/** URL factice injectée au build e2e (`npm run build:e2e`). Aucune vraie base n'est contactée. */
export const SUPABASE = 'http://127.0.0.1:54321'

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function fakeSession(userId: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const access_token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, email, role: 'authenticated', exp })}.c2ln`
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  }
  return {
    access_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'refresh-e2e',
    user,
  }
}

/** Petit fichier WAV (2 s de La 440 Hz très doux) pour simuler un extrait. */
export function wavTone(seconds = 2, rate = 8000): Buffer {
  const n = seconds * rate
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 800), 44 + i * 2)
  return buf
}

export const CATALOG = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Get Lucky',
    artist_name: 'Daft Punk',
    album: 'Random Access Memories',
    cover_url: null,
    release_year: 2013,
    deezer_id: 67238735,
    preview_source: 'deezer',
    preview_url: null,
    preview_expires_at: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'One More Time',
    artist_name: 'Daft Punk',
    album: 'Discovery',
    cover_url: null,
    release_year: 2000,
    deezer_id: 3135553,
    preview_source: 'deezer',
    preview_url: null,
    preview_expires_at: null,
  },
]

type State = {
  users: { id: string; email: string; username: string; password: string }[]
  me?: string
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Simule le strict nécessaire de Supabase (Auth + PostgREST) pour les parcours e2e. */
export async function mockSupabase(page: Page, state: State = { users: [] }) {
  const current = () => state.users.find((u) => u.id === state.me)
  // Extraits audio simulés (le CDN Deezer réel n'est jamais contacté).
  await page.route('https://cdnt-preview.dzcdn.net/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: wavTone() }),
  )

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const body = req.postDataJSON?.() as Record<string, string> | null

    switch (`${req.method()} ${url.pathname}`) {
      case 'POST /functions/v1/music': {
        const action = body?.action
        if (action === 'search') return json(route, { tracks: CATALOG, cached: false })
        if (action === 'preview') {
          const t = CATALOG.find((c) => c.id === (body as unknown as { trackId: string }).trackId)
          const exp = new Date(Date.now() + 3600_000).toISOString()
          return json(route, {
            track: {
              ...t,
              preview_url: `https://cdnt-preview.dzcdn.net/e2e/${t?.deezer_id}.wav?hdnea=exp=1`,
              preview_expires_at: exp,
            },
          })
        }
        return json(route, { error: 'invalid_input' }, 400)
      }
      case 'POST /rest/v1/rpc/username_available':
        return json(
          route,
          !state.users.some((u) => u.username.toLowerCase() === body?.p_username?.toLowerCase()),
        )
      case 'POST /auth/v1/signup': {
        const meta = (body as unknown as { data: { username: string } }).data
        const u = {
          id: crypto.randomUUID(),
          email: body!.email!,
          username: meta.username,
          password: body!.password!,
        }
        state.users.push(u)
        state.me = u.id
        return json(route, fakeSession(u.id, u.email))
      }
      case 'POST /rest/v1/rpc/login_email_for': {
        const u = state.users.find(
          (x) => x.username.toLowerCase() === body?.p_username?.toLowerCase(),
        )
        return json(route, u && u.password === body?.p_password ? u.email : null)
      }
      case 'POST /auth/v1/token': {
        const u = state.users.find((x) => x.email === body?.email && x.password === body?.password)
        if (!u)
          return json(
            route,
            {
              code: 'invalid_credentials',
              error_code: 'invalid_credentials',
              msg: 'Invalid login credentials',
            },
            400,
          )
        state.me = u.id
        return json(route, fakeSession(u.id, u.email))
      }
      case 'POST /auth/v1/logout':
        state.me = undefined
        return route.fulfill({ status: 204 })
      case 'POST /rest/v1/rpc/generate_recovery_codes':
        return json(route, [
          'ABCD-EFGH',
          'JKLM-NPQR',
          'STUV-WXYZ',
          '2345-6789',
          'AB23-CD45',
          'EF67-GH89',
          'JK23-LM45',
          'NP67-QR89',
        ])
      case 'POST /rest/v1/rpc/recovery_codes_remaining':
        return json(route, 8)
      case 'GET /rest/v1/profiles': {
        const u = current()
        return u
          ? json(route, {
              id: u.id,
              username: u.username,
              display_name: null,
              avatar_seed: 'a1b2c3',
              created_at: new Date().toISOString(),
            })
          : json(route, { message: 'not found' }, 406)
      }
      case 'GET /rest/v1/profile_settings':
        return json(route, {
          locale: 'fr',
          profile_visibility: 'friends',
          stats_visibility: 'friends',
          activity_visibility: 'friends',
          searchable: true,
          twins_opt_in: false,
          birth_year: null,
        })
      default:
        return json(route, { message: `non simulé : ${req.method()} ${url.pathname}` }, 501)
    }
  })
}
