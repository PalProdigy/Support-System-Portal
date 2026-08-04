import type { NotificationChannel } from '@/types'

export interface ChannelPayload {
  userId: string
  type: string
  message: string
  phone?: string
  meta?: Record<string, unknown>
}

export interface ChannelAdapter {
  channel: NotificationChannel
  send(payload: ChannelPayload): void
}

// Dispatch to every enabled non-in_app channel for a user.
// In-app delivery is handled by DataProvider (persisted to localStorage / DB).
export function dispatchToChannels(
  adapters: ChannelAdapter[],
  enabledChannels: NotificationChannel[],
  payload: ChannelPayload,
  phoneByChannel?: Partial<Record<NotificationChannel, string | undefined>>
): void {
  for (const adapter of adapters) {
    if (adapter.channel !== 'in_app' && enabledChannels.includes(adapter.channel)) {
      try {
        adapter.send({ ...payload, phone: phoneByChannel?.[adapter.channel] })
      } catch (err) {
        console.warn(`[Dispatcher] ${adapter.channel} adapter error:`, err)
      }
    }
  }
}
