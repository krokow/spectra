import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'

export default function DiscoverPage() {
  const { t } = useTranslation()
  return <EmptyState title={t('discover.emptyTitle')} description={t('discover.emptyText')} />
}
