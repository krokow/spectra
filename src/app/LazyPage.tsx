import { Suspense, type ReactNode } from 'react'
import { SplashScreen } from '@/components/brand/SplashScreen'

export function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SplashScreen />}>{children}</Suspense>
}
