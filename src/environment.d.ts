declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URI: string
      PAYLOAD_SECRET: string
      NEXT_PUBLIC_SERVER_URL: string

      GREENAPI_INSTANCE_ID: string
      GREENAPI_API_TOKEN: string
      GREENAPI_ADMIN_WHATSAPP: string

      RESEND_API_KEY: string
      RESEND_FROM_EMAIL: string
      ADMIN_EMAIL: string

      CRON_SECRET: string
      WHATSAPP_ADMIN_NOTIFICATION: string
    }
  }
}

export {}
