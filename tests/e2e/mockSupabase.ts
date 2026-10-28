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

type State = {
  users: { id: string; email: string; username: string; password: string }[]
  me?: string
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Simule le strict nécessaire de Supabase (Auth + PostgREST) pour les parcours e2e. */
export async function mockSupabase(page: Page, state: State = { users: [] }) {
  const current = () => state.users.find((u) => u.id === state.me)

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const body = req.postDataJSON?.() as Record<string, string> | null

    switch (`${req.method()} ${url.pathname}`) {
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
