import { AudioLines, Compass, ListMusic, Moon, ShieldCheck, Sun, User, Users } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { Wordmark } from '@/components/brand/Wordmark'
import { Avatar } from '@/components/profile/Avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsAdmin, useMyProfile, useMySettings } from '@/features/profile/api'
import { setLanguage } from '@/i18n'
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
  const { t, i18n } = useTranslation()
  const { theme, toggle } = useTheme()
  const profile = useMyProfile()
  const locale = useMySettings().data?.locale

  // La langue enregistrée dans le profil suit l'utilisateur d'un appareil à l'autre.
  useEffect(() => {
    if (locale && locale !== i18n.language) setLanguage(locale)
  }, [locale, i18n.language])

  const isAdmin = useIsAdmin().data === true
  const p = profile.data

  return (
    <div className="min-h-dvh">
      <div className="ambient-glow" aria-hidden />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-bg-elevated px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        {t('common.skipToContent')}
      </a>

      {/* Ordinateur : barre latérale fixe */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-y-0 border-l-0 p-5 lg:flex">
        <NavLink to="/" aria-label={t('nav.home')} className="self-start rounded-md">
          <Wordmark />
        </NavLink>
        <nav aria-label={t('nav.label')} className="flex-1">
          <ul className="flex flex-col gap-1">
            {NAV.map(({ to, key, icon: Icon }) => (
              <li key={key}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-md px-3 font-medium transition-colors',
                      isActive
                        ? 'bg-surface-strong text-fg'
                        : 'text-fg-muted hover:bg-surface hover:text-fg',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon aria-hidden className={cn('size-5', isActive && 'text-accent')} />
                      {t(`nav.${key}`)}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            {isAdmin && (
              <li className="mt-4">
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-md px-3 font-medium transition-colors',
                      isActive
                        ? 'bg-surface-strong text-fg'
                        : 'text-fg-muted hover:bg-surface hover:text-fg',
                    )
                  }
                >
                  <ShieldCheck aria-hidden className="size-5" />
                  {t('nav.admin')}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          {p && (
            <NavLink
              to="/profile"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 hover:bg-surface"
            >
              <Avatar seed={p.avatar_seed} name={p.display_name || p.username} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {p.display_name || p.username}
                </span>
                <span className="block truncate text-xs text-fg-muted">@{p.username}</span>
              </span>
            </NavLink>
          )}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('theme.toggle')}>
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </Button>
        </div>
      </aside>

      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col lg:max-w-none lg:pl-64">
        {/* Mobile et tablette : en-tête compact */}
        <header className="safe-top sticky top-0 z-30 flex h-(--header-height) items-center justify-between px-4 backdrop-blur-md lg:hidden">
          <NavLink to="/" aria-label={t('nav.home')} className="rounded-md">
            <Wordmark />
          </NavLink>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('theme.toggle')}>
              {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </Button>
            {p && (
              <NavLink
                to="/profile"
                aria-label={t('nav.profile')}
                className="tap flex items-center justify-center rounded-full"
              >
                <Avatar seed={p.avatar_seed} name={p.display_name || p.username} size={34} />
              </NavLink>
            )}
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(var(--nav-height)+1.5rem)] outline-none sm:px-6 lg:px-10 lg:pt-6 lg:pb-12"
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile et tablette : barre de navigation en bas */}
      <nav
        aria-label={t('nav.label')}
        className="glass safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl rounded-t-xl border-b-0 lg:hidden"
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
