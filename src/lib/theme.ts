import { create } from 'zustand'

export type Theme = 'dark' | 'light'
const KEY = 'spectra-theme'

function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

type ThemeState = { theme: Theme; toggle: () => void }

export const useTheme = create<ThemeState>((set, get) => ({
  theme: typeof document === 'undefined' ? 'dark' : readTheme(),
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    const apply = () => {
      document.documentElement.classList.toggle('dark', next === 'dark')
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'dark' ? '#0B0A14' : '#F7F6FB')
      set({ theme: next })
    }
    // View Transitions API quand dispo, sinon bascule directe.
    if (
      'startViewTransition' in document &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.startViewTransition(apply)
    } else {
      apply()
    }
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* stockage indisponible */
    }
  },
}))
