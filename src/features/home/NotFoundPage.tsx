import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <EmptyState
      title={t('notFound.title')}
      description="404"
      action={
        <Button asChild variant="glass">
          <Link to="/">{t('notFound.cta')}</Link>
        </Button>
      }
    />
  )
}
