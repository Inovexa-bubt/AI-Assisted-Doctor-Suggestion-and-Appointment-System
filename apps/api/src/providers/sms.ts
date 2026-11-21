import type { AppConfig } from '../config.ts'

export interface SmsSendResult {
  status: 'sent' | 'failed'
  error?: string
}

export interface SmsProvider {
  readonly name: string
  readonly isSandbox: boolean
  send(phone: string, message: string): Promise<SmsSendResult>
}

export function createSmsProvider(cfg: AppConfig): SmsProvider {
  if (cfg.smsProvider === 'bulksmsbd' && cfg.smsApiKey) {
    return {
      name: 'bulksmsbd',
      isSandbox: false,
      async send(phone: string, message: string): Promise<SmsSendResult> {
        try {
          const number = phone.startsWith('01') ? `88${phone}` : phone
          const params = new URLSearchParams({
            api_key: cfg.smsApiKey,
            type: 'text',
            number,
            senderid: cfg.smsSenderId,
            message,
          })
          const res = await fetch(`https://bulksmsbd.net/api/smsapi?${params.toString()}`)
          const body = (await res.json().catch(() => ({}))) as {
            response_code?: number
            error_message?: string
          }
          if (res.ok && (body.response_code === 202 || body.response_code === 200)) {
            return { status: 'sent' }
          }
          return { status: 'failed', error: body.error_message ?? `HTTP ${res.status}` }
        } catch (err) {
          return { status: 'failed', error: String(err) }
        }
      },
    }
  }

  if (cfg.smsProvider === 'webhook' && cfg.smsWebhookUrl) {
    return {
      name: 'webhook',
      isSandbox: false,
      async send(phone: string, message: string): Promise<SmsSendResult> {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (cfg.smsApiKey) headers.Authorization = `Bearer ${cfg.smsApiKey}`
          const res = await fetch(cfg.smsWebhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ to: phone, senderId: cfg.smsSenderId, message }),
          })
          return res.ok ? { status: 'sent' } : { status: 'failed', error: `HTTP ${res.status}` }
        } catch (err) {
          return { status: 'failed', error: String(err) }
        }
      },
    }
  }

  return {
    name: 'sandbox',
    isSandbox: true,
    async send(_phone: string, _message: string): Promise<SmsSendResult> {
      return { status: 'sent' }
    },
  }
}
