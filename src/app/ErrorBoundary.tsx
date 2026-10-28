import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '@/i18n'
import { Button } from '@/components/ui/button'

type State = { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Aucune télémétrie tierce : journal local uniquement.
    console.error(error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <h1 className="text-2xl font-bold">{i18n.t('error.title')}</h1>
        <p className="max-w-sm text-fg-muted">{i18n.t('error.text')}</p>
        <Button onClick={() => location.reload()}>{i18n.t('common.retry')}</Button>
      </div>
    )
  }
}
