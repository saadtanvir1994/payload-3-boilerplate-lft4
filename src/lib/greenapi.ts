/**
 * GreenAPI WhatsApp integration.
 *
 * Docs: https://green-api.com/en/docs/api/sending/SendMessage/
 *
 * Environment variables required:
 *   GREENAPI_INSTANCE_ID  — e.g. 7105219240
 *   GREENAPI_API_TOKEN    — API token from GreenAPI dashboard
 */

const BASE_URL = 'https://api.green-api.com'

export interface SendMessageResult {
  success: boolean
  idMessage?: string
  error?: string
}

/**
 * Converts a mobile number to a GreenAPI chatId.
 * GreenAPI chatId format: <international_number>@c.us
 *
 * Handles these input formats:
 *   03001234567   → 923001234567@c.us  (Pakistani local, leading 0)
 *   923001234567  → 923001234567@c.us  (already international)
 *   +923001234567 → 923001234567@c.us  (with + prefix)
 */
export function toChatId(mobileNumber: string): string {
  // Strip any leading +
  let cleaned = mobileNumber.replace(/^\+/, '')

  // Pakistani local format: starts with 0 followed by 9-10 digits
  // Convert 0XXXXXXXXXX → 92XXXXXXXXXX
  if (/^0\d{9,10}$/.test(cleaned)) {
    cleaned = '92' + cleaned.slice(1)
  }

  return `${cleaned}@c.us`
}

/**
 * Sends a WhatsApp message via GreenAPI.
 *
 * @param chatId  - Recipient chatId in format 923001234567@c.us
 * @param message - Plain text or WhatsApp-formatted message body
 */
export async function sendWhatsAppMessage(
  chatId: string,
  message: string,
): Promise<SendMessageResult> {
  const instanceId = process.env.GREENAPI_INSTANCE_ID
  const apiToken = process.env.GREENAPI_API_TOKEN

  if (!instanceId || !apiToken) {
    console.error('[GreenAPI] Missing GREENAPI_INSTANCE_ID or GREENAPI_API_TOKEN env vars')
    return { success: false, error: 'GreenAPI credentials not configured' }
  }

  const url = `${BASE_URL}/waInstance${instanceId}/sendMessage/${apiToken}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId,
        message,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[GreenAPI] HTTP ${response.status}: ${text}`)
      return { success: false, error: `HTTP ${response.status}: ${text}` }
    }

    const data = (await response.json()) as { idMessage?: string }
    return { success: true, idMessage: data.idMessage }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[GreenAPI] Fetch error: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * Sends a WhatsApp message to the admin notification number.
 * Uses WHATSAPP_ADMIN_NOTIFICATION env var.
 */
export async function sendAdminWhatsAppNotification(
  message: string,
): Promise<SendMessageResult> {
  const adminNumber = process.env.WHATSAPP_ADMIN_NOTIFICATION

  if (!adminNumber) {
    console.error('[GreenAPI] Missing WHATSAPP_ADMIN_NOTIFICATION env var')
    return { success: false, error: 'Admin WhatsApp number not configured' }
  }

  return sendWhatsAppMessage(toChatId(adminNumber), message)
}