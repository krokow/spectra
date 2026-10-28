import { Compass, ListMusic, Moon, AudioLines, Sun, User, Users } from 'lucide-react'
import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { Wordmark } from '@/components/brand/Wordmark'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { UpdatePrompt } from './pwa/UpdatePrompt'

const NAV = [
  { to: '/discover', key: 'discover', icon: Compass },
  { to: '/spectrum', key: 'spectrum', icon: AudioLines },
  { to: '/friends', key: 'friends', icon: Users },
  { to: '/playlists', key: 'playlists', icon: ListMusic },
  { to: '/profile', key: 'profile', icon: User },
] as const

function PageFallback() {
  return (
    <div className="space-y-4 p-4" aria-busy>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  )
}

export function AppLayout() {
  const { t } = useTranslation()
  const { theme, toggle } = useTheme()

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <div className="ambient-glow" aria-hidden />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-bg-elevated px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Aller au contenu
      </a>
      <header className="safe-top sticky top-0 z-30 flex h-(--header-height) items-center justify-between px-4 backdrop-blur-md">
        <NavLink to="/" aria-label="Spectra, accueil" className="rounded-md">
          <Wordmark />
        </NavLink>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('theme.toggle')}>
          {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </Button>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 px-4 pb-[calc(var(--nav-height)+1.5rem)] outline-none"
      >
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label={t('nav.label')}
        className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl rounded-t-xl border-b-0"
      >
        <ul className="flex h-(--nav-height) items-stretch justify-around px-1">
          {NAV.map(({ to, key, icon: Icon }) => (
            <li key={key} className="flex flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'tap flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-[0.7rem] font-medium transition-colors',
                    isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden className={cn('size-6', isActive && 'text-accent')} />
                    <span>{t(`nav.${key}`)}</span>
                    <span
                      aria-hidden
                      className={cn(
                        'bg-spectrum h-1 w-6 rounded-full transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <UpdatePrompt />
    </div>
  )
}
