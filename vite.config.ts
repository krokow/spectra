import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Domaines tiers autorisés par la CSP (extraits audio et pochettes). Aucun script tiers.
const MEDIA_HOSTS = [
  'https://*.dzcdn.net',
  'https://*.mzstatic.com',
  'https://audio-ssl.itunes.apple.com',
]
const IMG_HOSTS = [
  'https://*.dzcdn.net',
  'https://*.mzstatic.com',
  'https://lastfm.freetls.fastly.net',
]

function buildCsp(supabaseUrl: string | undefined, dev: boolean): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null
  const connect = ["'self'"]
  if (supabase) connect.push(supabase.origin, `wss://${supabase.host}`)
  if (dev) connect.push('ws:', 'http://localhost:*', 'http://127.0.0.1:*')
  const img = ["'self'", 'data:', 'blob:', ...IMG_HOSTS]
  if (supabase) img.push(supabase.origin)
  return [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    `media-src 'self' blob: ${MEDIA_HOSTS.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

// GitHub Pages ne permet pas d'en-têtes HTTP : la CSP est injectée en <meta>.
function cspPlugin(csp: string): Plugin {
  return {
    name: 'spectra-csp',
    transformIndexHtml: (html) => html.replace('%SPECTRA_CSP%', csp),
  }
}

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const dev = command === 'serve' && !isPreview
  const base = env.VITE_BASE_PATH || (dev ? '/' : '/spectra/')

  return {
    base,
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(buildCsp(env.VITE_SUPABASE_URL, dev)),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon-180.png'],
        manifest: {
          id: base,
          name: 'Spectra',
          short_name: 'Spectra',
          description: 'Ton spectre musical, tes découvertes, tes amis.',
          lang: 'fr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#0B0A14',
          background_color: '#0B0A14',
          categories: ['music', 'entertainment', 'social'],
          icons: [
            { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Découvrir',
              url: `${base}#/discover`,
              icons: [{ src: 'icons/pwa-192.png', sizes: '192x192' }],
            },
            {
              name: 'Question du jour',
              url: `${base}#/daily`,
              icons: [{ src: 'icons/pwa-192.png', sizes: '192x192' }],
            },
            {
              name: 'Mon spectre',
              url: `${base}#/spectrum`,
              icons: [{ src: 'icons/pwa-192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Polices : seuls les sous-ensembles latins sont précachés (les autres restent chargés à la demande).
          globIgnores: [
            '**/og-image.png',
            '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
          ],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            // Les extraits audio ne sont JAMAIS mis en cache (droits + URL signées qui expirent).
            {
              urlPattern: ({ request }) => request.destination === 'audio',
              handler: 'NetworkOnly',
            },
            // Pochettes : cache borné.
            {
              urlPattern: ({ request, sameOrigin }) =>
                request.destination === 'image' && !sameOrigin,
              handler: 'CacheFirst',
              options: {
                cacheName: 'covers',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'react'
              if (id.includes('framer-motion') || id.includes('motion-')) return 'motion'
              if (id.includes('@supabase')) return 'supabase'
            }
            return undefined
          },
        },
      },
    },
  }
})
