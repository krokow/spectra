import { z } from 'zod'

const Env = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
})

const parsed = Env.safeParse(import.meta.env)

/** Configuration publique injectée au build. `null` si absente (ex. build de contrôle en CI). */
export const env = parsed.success
  ? { supabaseUrl: parsed.data.VITE_SUPABASE_URL, supabaseKey: parsed.data.VITE_SUPABASE_ANON_KEY }
  : null
