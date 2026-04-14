/**
 * Notification dispatcher for Alpha Wheels.
 *
 * All outbound WhatsApp messages go through sendNotification().
 * Every sent message is logged to the notifications collection.
 *
 * Active channel: WhatsApp via GreenAPI.
 * Email channel is wired but bypassed — uncomment the Resend block when ready.
 */

import type { BasePayload } from 'payload'
import { sendWhatsAppMessage, sendAdminWhatsAppNotification, toChatId } from './greenapi'

// ─── Notification type union ─────────────────────────────────────────────────

export type NotificationType =
  | 'OTP'
  | 'Booking Confirmed'
  | 'Booking Cancelled'
  | 'Payment Confirmed'
  | 'Reminder'
  | 'Tier Upgrade'
  | 'Free Slot Unlocked'
  | 'Referral Reward'
  | 'Review Thanks'
  | 'Cancellation Request Alert'
  | 'Booking Completed'

export type NotificationChannel = 'WhatsApp' | 'Email'

export type RecipientType = 'customer' | 'admin'

// ─── Context shapes ───────────────────────────────────────────────────────────

export interface NotificationContext {
  customerName?: string
  customerWhatsapp?: string
  bookingReference?: string
  serviceName?: string
  slotDate?: string
  slotStartTime?: string
  slotEndTime?: string
  location?: string
  finalPrice?: number
  tierName?: string
  loyaltyPointsEarned?: number
  loyaltyPointsBalance?: number
  voucherCode?: string
  reviewLink?: string
  cancellationReason?: string
  otpCode?: string
  carType?: string
  carModel?: string
  carYear?: string
  carColor?: string
}

// ─── Args ─────────────────────────────────────────────────────────────────────

export interface SendNotificationArgs {
  payload: BasePayload
  type: NotificationType  // Change this from the inline union to use your exported type
  channel?: NotificationChannel
  /** Payload user id — used to log and resolve whatsapp number if context not supplied */
  userId?: number
  recipientType?: RecipientType
  /** Pre-resolved context — skips DB lookups when data is already in memory */
  context?: NotificationContext
}
// ─── Message builders ─────────────────────────────────────────────────────────

function buildMessage(
  type: NotificationType,
  recipientType: RecipientType,
  ctx: NotificationContext,
): string {
  const name = ctx.customerName ?? 'Customer'
  const ref = ctx.bookingReference ?? 'N/A'
  const service = ctx.serviceName ?? 'N/A'
  const date = ctx.slotDate ?? 'N/A'
  const time = ctx.slotStartTime ?? 'N/A'
  const location = ctx.location ?? 'N/A'
  const price =
    ctx.finalPrice !== undefined ? `PKR ${ctx.finalPrice.toLocaleString()}` : 'N/A'
  const car = [ctx.carModel, ctx.carYear, ctx.carColor ? `(${ctx.carColor})` : '']
    .filter(Boolean).join(' ') || 'N/A'
  const whatsapp = ctx.customerWhatsapp ?? 'N/A'

  switch (type) {
    case 'OTP':
      return (
        `Your Alpha Wheels verification code is: *${ctx.otpCode ?? '------'}*\n\n` +
        `This code expires in 10 minutes. Do not share it with anyone.`
      )

    case 'Booking Confirmed':
      if (recipientType === 'admin') {
        return (
          `🆕 *New Booking — ${ref}*\n\n` +
          `Customer: ${name}\n` +
          `Service: ${service}\n` +
          `Date: ${date} at ${time}\n` +
          `Location: ${location}\n` +
          `Amount: ${price}`
        )
      }
      return (
        `✅ *Booking Confirmed — Alpha Wheels*\n\n` +
        `Hi ${name}! Your booking has been confirmed. 🎉\n\n` +
        `📋 *Booking Details*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔖 Ref: ${ref}\n` +
        `🔧 Service: ${service}\n` +
        `🚗 Car: ${car}\n` +
        `🏷 Car Type: ${ctx.carType ?? 'N/A'}\n` +
        `📅 Date: ${date}\n` +
        `⏰ Time: ${time}\n` +
        `📍 Location: ${location}\n` +
        `💰 Amount: ${price}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *Status: Approved*\n` +
        `Your booking is confirmed. Please complete your bank transfer if not done yet.\n\n` +
        `📋 *Terms & Conditions*\n` +
        `• Please arrive on time. Late arrivals may result in a shorter service time.\n` +
        `• Ensure your vehicle is accessible and unlocked before the appointment.\n` +
        `• We are not responsible for pre-existing damage to the vehicle.\n` +
        `• Services may vary slightly based on vehicle condition.\n\n` +
        `❌ *Cancellation Policy*\n` +
        `• 24+ hours before appointment: Full refund.\n` +
        `• Less than 24 hours before: No refund.\n` +
        `• No-shows will be charged in full.\n` +
        `• To cancel, use the booking portal or contact us directly.`
      )

    case 'Booking Cancelled':
      if (recipientType === 'admin') {
        return (
          `❌ *Booking Cancelled — ${ref}*\n\n` +
          `Customer: ${name}\n` +
          `Reason: ${ctx.cancellationReason ?? 'Not provided'}`
        )
      }
      return (
        `❌ *Booking Cancelled — ${ref}*\n\n` +
        `Hi ${name}, your booking has been cancelled.\n\n` +
        `📋 *Booking Details*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔖 Ref: ${ref}\n` +
        `🔧 Service: ${service}\n` +
        `🚗 Car: ${car}\n` +
        `📅 Date: ${date}\n` +
        `⏰ Time: ${time}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        (ctx.cancellationReason ? `\n📝 Reason: ${ctx.cancellationReason}\n` : '') +
        `\nTo rebook, please visit our website or contact us directly.`
      )

    case 'Payment Confirmed':
      return (
        `💳 *Payment Confirmed — ${ref}*\n\n` +
        `Hi ${name}, we have received your payment of ${price}.\n\n` +
        `Your booking is now confirmed. See you on ${date} at ${time}!`
      )

    case 'Reminder':
      return (
        `⏰ *Appointment Reminder — ${ref}*\n\n` +
        `Hi ${name}, this is a reminder for your upcoming appointment.\n\n` +
        `Service: ${service}\n` +
        `Date: ${date} at ${time}\n` +
        `Location: ${location}\n\n` +
        `See you soon at Alpha Wheels!`
      )

    case 'Tier Upgrade':
      return (
        `🌟 *Tier Upgrade — ${ctx.tierName ?? 'New Tier'}*\n\n` +
        `Congratulations ${name}! You have been upgraded to *${ctx.tierName ?? 'a new tier'}*.\n\n` +
        `Enjoy your enhanced loyalty benefits and multiplied points from your next booking!`
      )

    case 'Free Slot Unlocked':
      return (
        `🎁 *Free Service Unlocked!*\n\n` +
        `Great news ${name}! You have earned a *free service slot* as part of your loyalty cycle.\n\n` +
        `Book your next appointment and the free slot will be applied automatically.`
      )

    case 'Referral Reward':
      return (
        `🎉 *Referral Reward Earned!*\n\n` +
        `Hi ${name}, someone you referred has completed their first booking!\n\n` +
        `Your reward voucher code: *${ctx.voucherCode ?? 'N/A'}*\n\n` +
        `Use it on your next booking for a discount. Thank you for spreading the word!`
      )

    case 'Review Thanks':
      return (
        `⭐ *Thank You for Your Review!*\n\n` +
        `Hi ${name}, thank you for taking the time to leave a review.\n\n` +
        `Your feedback helps us improve and serve you better. See you next time at Alpha Wheels!`
      )

    case 'Cancellation Request Alert':
      return (
        `⚠️ *Cancellation Request — ${ref}*\n\n` +
        `Customer ${name} has requested to cancel their booking.\n\n` +
        `Service: ${service}\n` +
        `Date: ${date} at ${time}\n` +
        `Reason: ${ctx.cancellationReason ?? 'Not provided'}\n\n` +
        `Please review and action this in the admin panel.`
      )

    case 'Booking Completed':
      return (
        `🎉 *Service Completed — ${ref}*\n\n` +
        `Hi ${name}, your car detailing service has been completed!\n\n` +
        `📋 *Summary*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔖 Ref: ${ref}\n` +
        `🔧 Service: ${service}\n` +
        `🚗 Car: ${car}\n` +
        `📍 Location: ${location}\n` +
        `💰 Amount Paid: ${price}\n` +
        (ctx.loyaltyPointsEarned ? `⭐ Points Earned: +${ctx.loyaltyPointsEarned}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Thank you for choosing Alpha Wheels! We hope to see you again soon. 🚗✨`
      )

    default:
      return `Alpha Wheels notification: ${type}`
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function sendNotification(args: SendNotificationArgs): Promise<void> {
  const {
    payload,
    type,
    channel = 'WhatsApp',
    userId,
    recipientType = 'customer',
    context = {},
  } = args

  // Email channel is bypassed for now
  if (channel === 'Email') {
    payload.logger.info(`[notifications] Email channel bypassed for type=${type}`)
    return
  }

  // Resolve missing context fields from DB when userId is supplied
  let resolvedContext = { ...context }

  if (userId && (!resolvedContext.customerWhatsapp || !resolvedContext.customerName)) {
    try {
      const user = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      })
      resolvedContext.customerName = resolvedContext.customerName ?? (user.fullName as string | undefined) ?? 'Customer'
      resolvedContext.customerWhatsapp =
        resolvedContext.customerWhatsapp ??
        (user.whatsappNumber as string | undefined) ??
        (user.mobileNumber as string | undefined) ??
        undefined
    } catch (err) {
      payload.logger.error(`[notifications] Failed to resolve user ${userId}: ${String(err)}`)
    }
  }

  const message = buildMessage(type, recipientType, resolvedContext)

  let success = false
  let errorMessage: string | undefined

  try {
    if (recipientType === 'admin') {
      const result = await sendAdminWhatsAppNotification(message)
      success = result.success
      errorMessage = result.error
    } else {
      const whatsapp = resolvedContext.customerWhatsapp
      if (!whatsapp) {
        payload.logger.error(
          `[notifications] No WhatsApp number for customer userId=${userId} type=${type}`,
        )
        success = false
        errorMessage = 'No WhatsApp number resolved'
      } else {
        const result = await sendWhatsAppMessage(toChatId(whatsapp), message)
        success = result.success
        errorMessage = result.error
      }
    }
  } catch (err) {
    success = false
    errorMessage = err instanceof Error ? err.message : String(err)
    payload.logger.error(`[notifications] Send error for type=${type}: ${errorMessage}`)
  }

  // Log every attempt to the notifications collection
  try {
    await payload.create({
      collection: 'notifications',
      data: {
        user: userId ?? undefined,
     type: type as any, 
        channel,
        messageBody: message,
        status: success ? 'Sent' : 'Failed',
        sentAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch (logErr) {
    payload.logger.error(
      `[notifications] Failed to log notification to DB: ${String(logErr)}`,
    )
  }
}