import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'

export default function PlaylistsPage() {
  const { t } = useTranslation()
  return <EmptyState title={t('playlists.emptyTitle')} description={t('playlists.emptyText')} />
}
