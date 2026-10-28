import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { SplashScreen } from '@/components/brand/SplashScreen'
import { env } from '@/lib/env'
import { ConfigMissing } from './ConfigMissing'
import { useAuth } from './authContext'
import { peekPostAuthTarget } from './postAuth'

/** Pas de compte, pas d'accès : toute l'app est derrière cette garde. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (!env) return <ConfigMissing />
  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  return children
}

/** Pages publiques (connexion, inscription) : redirige vers l'app si déjà connecté. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from
  if (!env) return <ConfigMissing />
  if (loading) return <SplashScreen />
  if (session) {
    const target = peekPostAuthTarget()
    return <Navigate to={target?.path ?? from ?? '/'} state={target?.state} replace />
  }
  return children
}
