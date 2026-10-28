import { Download, KeyRound, Loader2, LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '@/components/profile/Avatar'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { signOut } from '@/features/auth/api'
import { authErrorKey } from '@/features/auth/errors'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  deleteMyAccount,
  exportMyData,
  useMyProfile,
  useIsAdmin,
  useMySettings,
  useRecoveryRemaining,
  useUpdateProfile,
  useUpdateSettings,
  type Settings,
  type Visibility,
} from './api'

const LEVELS: Visibility[] = ['public', 'friends', 'private']

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  render: (v: T) => ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div
        className="grid rounded-full bg-surface p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn(
              'tap rounded-full px-2 text-sm font-semibold transition-colors',
              value === o ? 'bg-spectrum-soft text-night' : 'text-fg-muted hover:text-fg',
            )}
          >
            {render(o)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-fg-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="mt-1 size-6 shrink-0 accent-violet"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function DisplayNameForm({
  initial,
  placeholder,
  pending,
  onSave,
}: {
  initial: string
  placeholder: string
  pending: boolean
  onSave: (value: string) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial)
  const changed = value.trim() !== initial
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value.trim())
      }}
    >
      <div className="flex-1">
        <Field
          label={t('profile.displayName')}
          value={value}
          maxLength={40}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit" variant="glass" disabled={!changed || pending}>
        {t('profile.save')}
      </Button>
    </form>
  )
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const profile = useMyProfile()
  const settings = useMySettings()
  const remaining = useRecoveryRemaining()
  const isAdmin = useIsAdmin().data === true
  const updateProfile = useUpdateProfile()
  const updateSettings = useUpdateSettings()

  const [regenOpen, setRegenOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const patch = (p: Partial<Settings>) => updateSettings.mutate(p)

  const onLanguage = (lang: Language) => {
    setLanguage(lang)
    patch({ locale: lang })
  }

  const onExport = async () => {
    setBusy('export')
    try {
      const data = await exportMyData()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      Object.assign(document.createElement('a'), {
        href: url,
        download: 'spectra-mes-donnees.json',
      }).click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async () => {
    setBusy('delete')
    setDeleteError(null)
    try {
      await deleteMyAccount(confirmName)
      navigate('/welcome', { replace: true })
    } catch (e) {
      setDeleteError(t(`auth.errors.${authErrorKey(e)}`))
      setBusy(null)
    }
  }

  if (profile.isPending || settings.isPending) {
    return (
      <div className="flex flex-col gap-4 pt-6" aria-busy>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }
  if (!profile.data || !settings.data) {
    return (
      <p role="alert" className="pt-6 text-danger">
        {t('error.text')}
      </p>
    )
  }
  const p = profile.data
  const s = settings.data

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header className="flex items-center gap-4">
        <Avatar seed={p.avatar_seed} name={p.display_name || p.username} size={72} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{p.display_name || p.username}</h1>
          <p className="text-fg-muted">@{p.username}</p>
          {isAdmin && (
            <Link
              to="/admin"
              className="bg-spectrum-soft mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-night"
            >
              <ShieldCheck className="size-4" aria-hidden />
              {t('profile.adminBadge')}
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <CardTitle>{t('profile.identity')}</CardTitle>
            <DisplayNameForm
              key={p.display_name ?? ''}
              initial={p.display_name ?? ''}
              placeholder={p.username}
              pending={updateProfile.isPending}
              onSave={(v) =>
                updateProfile.mutate({ display_name: v === '' ? null : v.slice(0, 40) })
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                updateProfile.mutate({
                  avatar_seed: crypto
                    .getRandomValues(new Uint8Array(6))
                    .reduce((a, b) => a + b.toString(16).padStart(2, '0'), ''),
                })
              }
            >
              {t('profile.shuffleAvatar')}
            </Button>
          </Card>

          <Card className="flex flex-col gap-5">
            <div>
              <CardTitle>{t('profile.privacy.title')}</CardTitle>
              <CardDescription>{t('profile.privacy.explain')}</CardDescription>
            </div>
            {(['profile_visibility', 'stats_visibility', 'activity_visibility'] as const).map(
              (key) => (
                <Segmented
                  key={key}
                  label={t(`profile.privacy.${key}`)}
                  value={s[key]}
                  options={LEVELS}
                  onChange={(v) => patch({ [key]: v })}
                  render={(v) => t(`profile.privacy.level.${v}`)}
                />
              ),
            )}
            <Toggle
              label={t('profile.privacy.searchable')}
              description={t('profile.privacy.searchableHint')}
              checked={s.searchable}
              onChange={(v) => patch({ searchable: v })}
            />
            <Toggle
              label={t('profile.privacy.twins')}
              description={t('profile.privacy.twinsHint')}
              checked={s.twins_opt_in}
              onChange={(v) => patch({ twins_opt_in: v })}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <CardTitle>{t('profile.language')}</CardTitle>
            <Segmented
              label={t('profile.language')}
              value={
                (LANGUAGES as readonly string[]).includes(i18n.language)
                  ? (i18n.language as Language)
                  : 'fr'
              }
              options={LANGUAGES}
              onChange={onLanguage}
              render={(v) => (v === 'fr' ? 'Français' : 'English')}
            />
          </Card>

          <Card className="flex flex-col gap-4">
            <div>
              <CardTitle>{t('profile.security.title')}</CardTitle>
              <CardDescription>
                {t('profile.security.remaining', { count: remaining.data ?? 0 })}
              </CardDescription>
            </div>
            <Button variant="glass" className="self-start" onClick={() => setRegenOpen(true)}>
              <KeyRound aria-hidden />
              {t('profile.security.regenerate')}
            </Button>
          </Card>

          <Card className="flex flex-col gap-3">
            <CardTitle>{t('profile.data.title')}</CardTitle>
            <CardDescription>{t('profile.data.explain')}</CardDescription>
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" onClick={() => void onExport()} disabled={busy === 'export'}>
                {busy === 'export' ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Download aria-hidden />
                )}
                {t('profile.data.export')}
              </Button>
              <Button
                variant="outline"
                onClick={() => void signOut().then(() => navigate('/welcome', { replace: true }))}
              >
                <LogOut aria-hidden />
                {t('profile.logout')}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="self-start text-danger"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden />
              {t('profile.data.delete')}
            </Button>
          </Card>
        </div>
      </div>

      <Dialog
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title={t('profile.security.regenerate')}
      >
        <p className="text-fg-muted">{t('profile.security.regenerateWarn')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRegenOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => navigate('/codes')}>
            {t('profile.security.regenerateConfirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('profile.data.deleteTitle')}
      >
        <p className="text-fg-muted">{t('profile.data.deleteWarn')}</p>
        <Field
          label={t('profile.data.deleteConfirmLabel', { username: p.username })}
          value={confirmName}
          autoCapitalize="none"
          onChange={(e) => setConfirmName(e.target.value)}
          error={deleteError ?? undefined}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={confirmName.toLowerCase() !== p.username.toLowerCase() || busy === 'delete'}
            onClick={() => void onDelete()}
          >
            {busy === 'delete' && <Loader2 className="animate-spin" aria-hidden />}
            {t('profile.data.deleteConfirm')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
