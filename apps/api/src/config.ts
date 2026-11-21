import 'dotenv/config'

export type AiProviderKind = 'mock' | 'gemini' | 'openai'
export type SttProviderKind = 'mock' | 'gemini' | 'openai'
export type SmsProviderKind = 'sandbox' | 'bulksmsbd' | 'webhook'

export interface AppConfig {
  port: number
  nodeEnv: string
  corsOrigin: string
  cookieSecure: boolean
  databaseUrl: string
  aiProvider: AiProviderKind
  geminiApiKey: string
  geminiModel: string
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
  sttProvider: SttProviderKind
  sttOpenaiModel: string
  smsProvider: SmsProviderKind
  smsApiKey: string
  smsSenderId: string
  smsWebhookUrl: string
  enableScheduler: boolean
  serveStatic: boolean
  autoSeed: boolean
  exposeDemoOtp: boolean
  databaseSsl: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const aiRaw = (env.AI_PROVIDER ?? 'mock').toLowerCase()
  const sttRaw = (env.STT_PROVIDER ?? 'mock').toLowerCase()
  const smsRaw = (env.SMS_PROVIDER ?? 'sandbox').toLowerCase()
  const nodeEnv = env.NODE_ENV ?? 'development'
  const smsProvider: SmsProviderKind =
    smsRaw === 'bulksmsbd' || smsRaw === 'webhook' ? smsRaw : 'sandbox'
  return {
    port: Number(env.PORT) || 4000,
    nodeEnv,
    corsOrigin:
      env.CORS_ORIGIN ??
      env.FRONTEND_URL ??
      (env.SERVE_STATIC === 'true' ? '' : 'http://localhost:5173'),
    cookieSecure: env.COOKIE_SECURE === 'true' || nodeEnv === 'production',
    databaseUrl: env.DATABASE_URL ?? 'pglite://./data/pglite',
    aiProvider: aiRaw === 'gemini' || aiRaw === 'openai' ? aiRaw : 'mock',
    geminiApiKey: env.GEMINI_API_KEY ?? '',
    geminiModel: env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    openaiApiKey: env.OPENAI_API_KEY ?? '',
    openaiBaseUrl: (env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiModel: env.OPENAI_MODEL ?? 'gpt-4o-mini',
    sttProvider: sttRaw === 'gemini' || sttRaw === 'openai' ? sttRaw : 'mock',
    sttOpenaiModel: env.STT_OPENAI_MODEL ?? 'whisper-1',
    smsProvider,
    smsApiKey: env.SMS_API_KEY ?? '',
    smsSenderId: env.SMS_SENDER_ID ?? 'LuminaHosp',
    smsWebhookUrl: env.SMS_WEBHOOK_URL ?? '',
    enableScheduler: env.ENABLE_SCHEDULER !== 'false',
    serveStatic: env.SERVE_STATIC === 'true',
    autoSeed: env.AUTO_SEED === 'true' || (env.AUTO_SEED !== 'false' && nodeEnv !== 'production'),
    exposeDemoOtp:
      smsProvider === 'sandbox' &&
      (env.EXPOSE_DEMO_OTP === 'true' ||
        (env.EXPOSE_DEMO_OTP !== 'false' && nodeEnv !== 'production')),
    databaseSsl: env.DATABASE_SSL === 'true',
  }
}
