import { lazy } from 'react'
import { createHashRouter } from 'react-router'
import { GuestOnly, RequireAuth } from '@/features/auth/RequireAuth'
import { AppLayout } from './AppLayout'
import { LazyPage } from './LazyPage'

// Code splitting par route.
const WelcomePage = lazy(() => import('@/features/auth/WelcomePage'))
const RecoverPage = lazy(() => import('@/features/auth/RecoverPage'))
const RecoveryCodesPage = lazy(() => import('@/features/auth/RecoveryCodesPage'))
const HomePage = lazy(() => import('@/features/home/HomePage'))
const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage'))
const SpectrumPage = lazy(() => import('@/features/spectrum/SpectrumPage'))
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'))
const PlaylistsPage = lazy(() => import('@/features/playlists/PlaylistsPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const DailyPage = lazy(() => import('@/features/daily/DailyPage'))
const NotFoundPage = lazy(() => import('@/features/home/NotFoundPage'))

// HashRouter : GitHub Pages ne réécrit pas les URL ; les liens profonds marchent dès le 1er chargement.
// Pas de compte, pas d'accès : seules /welcome et /recover sont publiques.
export const router = createHashRouter([
  {
    path: 'welcome',
    element: (
      <GuestOnly>
        <LazyPage>
          <WelcomePage />
        </LazyPage>
      </GuestOnly>
    ),
  },
  {
    path: 'recover',
    element: (
      <GuestOnly>
        <LazyPage>
          <RecoverPage />
        </LazyPage>
      </GuestOnly>
    ),
  },
  {
    path: 'codes',
    element: (
      <RequireAuth>
        <LazyPage>
          <RecoveryCodesPage />
        </LazyPage>
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'spectrum', element: <SpectrumPage /> },
      { path: 'friends', element: <FriendsPage /> },
      { path: 'playlists', element: <PlaylistsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'daily', element: <DailyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
