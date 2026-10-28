import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'

export default function DailyPage() {
  const { t } = useTranslation()
  return <EmptyState title={t('daily.title')} description={t('common.comingSoon')} />
}
