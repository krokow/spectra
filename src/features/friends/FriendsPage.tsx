import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'

export default function FriendsPage() {
  const { t } = useTranslation()
  return <EmptyState title={t('friends.emptyTitle')} description={t('friends.emptyText')} />
}
