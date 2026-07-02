import type { ChannelAdapter, ChannelPayload } from './dispatcher'

function stub(channel: string, payload: ChannelPayload) {
  console.log(`[${channel.toUpperCase()}] → user:${payload.userId} type:${payload.type} — "${payload.message}"`, payload.meta ?? '')
}

export const emailAdapter: ChannelAdapter = {
  channel: 'email',
  send: (p) => stub('EMAIL', p),
}

export const smsAdapter: ChannelAdapter = {
  channel: 'sms',
  send: (p) => stub('SMS', p),
}

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',
  send: (p) => stub('WHATSAPP', p),
}

export const webPushAdapter: ChannelAdapter = {
  channel: 'web_push',
  send: (p) => stub('WEB_PUSH', p),
}

export const ALL_ADAPTERS = [emailAdapter, smsAdapter, whatsappAdapter, webPushAdapter]
