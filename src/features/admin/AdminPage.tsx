import { ListChecks, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsAdmin } from '@/features/profile/api'

/**
 * Espace d'administration. La garde ici ne fait que masquer l'écran :
 * la vraie protection est en base (seul is_admin() peut modifier la banque de questions).
 */
export default function AdminPage() {
  const { t } = useTranslation()
  const admin = useIsAdmin()
  if (admin.isPending) return <Skeleton className="mt-6 h-40 w-full rounded-lg" />
  if (admin.data !== true) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="size-8 text-accent" aria-hidden />
        <h1 className="text-3xl font-bold">{t('admin.title')}</h1>
      </header>
      <Card className="flex items-start gap-4">
        <ListChecks className="mt-1 size-6 shrink-0 text-fg-muted" aria-hidden />
        <div>
          <CardTitle>{t('admin.questions.title')}</CardTitle>
          <CardDescription>{t('admin.questions.soon')}</CardDescription>
        </div>
      </Card>
    </div>
  )
}
