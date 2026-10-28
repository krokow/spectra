import { lazy } from 'react'
import { createHashRouter } from 'react-router'
import { AppLayout } from './AppLayout'

// Code splitting par route.
const HomePage = lazy(() => import('@/features/home/HomePage'))
const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage'))
const SpectrumPage = lazy(() => import('@/features/spectrum/SpectrumPage'))
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'))
const PlaylistsPage = lazy(() => import('@/features/playlists/PlaylistsPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const DailyPage = lazy(() => import('@/features/daily/DailyPage'))
const NotFoundPage = lazy(() => import('@/features/home/NotFoundPage'))

// HashRouter : GitHub Pages ne réécrit pas les URL ; les liens profonds marchent dès le 1er chargement.
export const router = createHashRouter([
  {
    element: <AppLayout />,
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
