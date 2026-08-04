'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { useSession } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CountryFlag } from '@/components/shared/country-flag'
import { toast } from '@/hooks/use-toast'
import { Bell, Mail, MessageSquare, Phone, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRY_CODES, DEFAULT_COUNTRY, splitPhone, joinPhone, isValidNationalNumber, nationalNumberMaxLength, type CountryCode } from '@/lib/country-codes'
import { NOTIFICATION_TYPE_CATEGORIES } from '@/lib/notification-types'
import type { NotificationChannel } from '@/types'

type PhoneChannel = 'sms' | 'whatsapp'
const PHONE_CHANNELS: PhoneChannel[] = ['sms', 'whatsapp']

const CHANNELS: { key: NotificationChannel; label: string; description: string; icon: React.ComponentType<{ className?: string }>; always?: boolean }[] = [
  { key: 'in_app', label: 'In-App', description: 'Notifications in the notification centre (always on)', icon: Bell, always: true },
  { key: 'email', label: 'Email', description: 'Receive updates at your registered email address', icon: Mail },
  { key: 'sms', label: 'SMS', description: 'Receive text messages to your registered phone', icon: Phone },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Receive messages on WhatsApp', icon: MessageSquare },
  { key: 'web_push', label: 'Web Push', description: 'Browser push notifications when the app is not open', icon: Monitor },
]

export interface NotificationPreferencesHandle {
  save: () => void
  isDirty: boolean
  isPending: boolean
}

interface NotificationPreferencesProps {
  section?: 'all' | 'channels' | 'types'
  hideSaveButton?: boolean
  onStateChange?: (state: { isDirty: boolean; isPending: boolean }) => void
  extraChannelItem?: React.ReactNode
  extraTypeItem?: React.ReactNode
}

export const NotificationPreferences = forwardRef<NotificationPreferencesHandle, NotificationPreferencesProps>(
  function NotificationPreferences({ section = 'all', hideSaveButton = false, onStateChange, extraChannelItem, extraTypeItem }, ref) {
  const session = useSession()
  const dp = getDataProvider()
  const qc = useQueryClient()

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notif-prefs', session.userId],
    queryFn: () => dp.getUserNotifPrefs(session.userId),
  })

  const [enabled, setEnabled] = useState<Set<NotificationChannel>>(new Set(['in_app']))
  const [phones, setPhones] = useState<Record<PhoneChannel, string>>({ sms: '', whatsapp: '' })
  const [countries, setCountries] = useState<Record<PhoneChannel, CountryCode>>({ sms: DEFAULT_COUNTRY, whatsapp: DEFAULT_COUNTRY })
  const [disabledTypes, setDisabledTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (prefs) setEnabled(new Set(prefs.channels))
  }, [prefs])

  useEffect(() => {
    if (prefs) setDisabledTypes(new Set(prefs.disabled_types ?? []))
  }, [prefs])

  useEffect(() => {
    if (!prefs) return
    const sms = splitPhone(prefs.sms_phone)
    const whatsapp = splitPhone(prefs.whatsapp_phone)
    setPhones({ sms: sms.national, whatsapp: whatsapp.national })
    setCountries({ sms: sms.country, whatsapp: whatsapp.country })
  }, [prefs])

  const saveMutation = useMutation({
    mutationFn: () => dp.updateUserNotifPrefs(session.userId, Array.from(enabled), {
      sms_phone: prefs?.sms_phone,
      whatsapp_phone: prefs?.whatsapp_phone,
      disabled_types: Array.from(disabledTypes),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-prefs', session.userId] })
      toast({ title: 'Notification preferences saved', variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to save preferences', variant: 'destructive' }),
  })

  const savePhoneMutation = useMutation({
    mutationFn: (channel: PhoneChannel) => dp.updateUserNotifPrefs(session.userId, Array.from(enabled), {
      sms_phone: channel === 'sms' ? joinPhone(countries.sms, phones.sms) : prefs?.sms_phone,
      whatsapp_phone: channel === 'whatsapp' ? joinPhone(countries.whatsapp, phones.whatsapp) : prefs?.whatsapp_phone,
    }),
    onSuccess: (_data, channel) => {
      qc.invalidateQueries({ queryKey: ['notif-prefs', session.userId] })
      toast({ title: `${channel === 'sms' ? 'SMS' : 'WhatsApp'} number saved`, variant: 'success' })
    },
    onError: () => toast({ title: 'Failed to save phone number', variant: 'destructive' }),
  })

  function toggle(ch: NotificationChannel) {
    if (ch === 'in_app') return // always on
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(ch)) next.delete(ch)
      else next.add(ch)
      return next
    })
  }

  function toggleCategory(types: string[], turnOn: boolean) {
    setDisabledTypes((prev) => {
      const next = new Set(prev)
      types.forEach((t) => (turnOn ? next.delete(t) : next.add(t)))
      return next
    })
  }

  const isDirty = prefs
    ? JSON.stringify([...enabled].sort()) !== JSON.stringify([...prefs.channels].sort())
      || JSON.stringify([...disabledTypes].sort()) !== JSON.stringify([...(prefs.disabled_types ?? [])].sort())
    : false

  useImperativeHandle(ref, () => ({
    save: () => saveMutation.mutate(),
    isDirty,
    isPending: saveMutation.isPending,
  }), [isDirty, saveMutation])

  useEffect(() => {
    onStateChange?.({ isDirty, isPending: saveMutation.isPending })
  }, [isDirty, saveMutation.isPending, onStateChange])

  if (isLoading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  const showChannels = section === 'all' || section === 'channels'
  const showTypes = section === 'all' || section === 'types'

  return (
    <div className="space-y-3">
      {showChannels && (
      <>
      <div>
        <h3 className="text-sm font-semibold text-foreground">Notification Channels</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Choose how you want to receive notifications. In-app is always enabled.</p>
      </div>

      <div className="space-y-2">
        {CHANNELS.map(({ key, label, description, icon: Icon, always }) => {
          const on = enabled.has(key)
          const isPhoneChannel = PHONE_CHANNELS.includes(key as PhoneChannel)
          const phoneKey = key as PhoneChannel
          const savedPhone = key === 'sms' ? prefs?.sms_phone : key === 'whatsapp' ? prefs?.whatsapp_phone : undefined
          const phoneDirty = isPhoneChannel && joinPhone(countries[phoneKey], phones[phoneKey]) !== (savedPhone ?? '')
          const phoneValid = isPhoneChannel && isValidNationalNumber(countries[phoneKey], phones[phoneKey])

          return (
            <div
              key={key}
              className={cn(
                'rounded-xl border p-3.5 transition-all',
                on ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('rounded-lg p-2 shrink-0', on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={() => toggle(key)}
                  disabled={always}
                  aria-label={`Turn ${label} ${on ? 'off' : 'on'}`}
                  className="shrink-0"
                />
              </div>

              {isPhoneChannel && (
                <div className="mt-3 pl-11 space-y-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={countries[phoneKey].iso2}
                    onValueChange={(iso2) => {
                      const country = COUNTRY_CODES.find((c) => c.iso2 === iso2)
                      if (country) setCountries((c) => ({ ...c, [phoneKey]: country }))
                    }}
                  >
                    <SelectTrigger className="h-8 w-[104px] shrink-0 text-sm px-2">
                      <SelectValue>
                        <span className="flex items-center gap-1.5">
                          <CountryFlag iso2={countries[phoneKey].iso2} />
                          <span>{countries[phoneKey].dial}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={c.iso2} value={c.iso2}>
                          <span className="flex items-center gap-2">
                            <CountryFlag iso2={c.iso2} />
                            <span>{c.name}</span>
                            <span className="text-muted-foreground">{c.dial}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone number"
                    value={phones[phoneKey]}
                    maxLength={nationalNumberMaxLength(countries[phoneKey])}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '')
                      setPhones((p) => ({ ...p, [phoneKey]: digitsOnly }))
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={phoneValid ? 'default' : 'outline'}
                    disabled={!phoneDirty || !phoneValid || (savePhoneMutation.isPending && savePhoneMutation.variables === phoneKey)}
                    onClick={() => savePhoneMutation.mutate(phoneKey)}
                  >
                    {savePhoneMutation.isPending && savePhoneMutation.variables === phoneKey ? 'Saving…' : 'Save'}
                  </Button>
                </div>
                {phones[phoneKey].length > 0 && !phoneValid && (
                  <p className="text-xs text-red-500">
                    {countries[phoneKey].iso2 === 'BD'
                      ? 'Enter a valid 10-digit number, no country code'
                      : 'Enter a valid phone number'}
                  </p>
                )}
                </div>
              )}
            </div>
          )
        })}
        {extraChannelItem}
      </div>
      </>
      )}

      {showTypes && (
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Notification Types</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose which events notify you at all. Turning one off silences it on every channel, including in-app.</p>
        </div>

        <div className="space-y-2">
          {NOTIFICATION_TYPE_CATEGORIES.map(({ key, label, description, icon: Icon, types }) => {
            const on = !types.every((t) => disabledTypes.has(t))
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 transition-all',
                  on ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                )}
              >
                <div className={cn('rounded-lg p-2 shrink-0', on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={(v) => toggleCategory(types, v)}
                  aria-label={`Turn ${label} notifications ${on ? 'off' : 'on'}`}
                  className="shrink-0"
                />
              </div>
            )
          })}
          {extraTypeItem}
        </div>
      </div>
      )}

      {!hideSaveButton && (
      <div className="flex justify-end pt-4">
        <Button size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
      )}
    </div>
  )
})
