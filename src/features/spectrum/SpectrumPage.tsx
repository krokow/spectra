import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'

export default function SpectrumPage() {
  const { t } = useTranslation()
  return <EmptyState title={t('spectrum.emptyTitle')} description={t('spectrum.emptyText')} />
}
