import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'type',
    defaultColumns: ['user', 'type', 'channel', 'status', 'sentAt'],
    // Notifications are append-only — prevent accidental edits in admin
  },
  access: {
    // Only the system creates notifications (via overrideAccess in lib/notifications.ts)
    create: adminOnly,
    // Admins can read the log; customers never see it
    read: adminOnly,
    // Immutable — no updates or deletes
    update: () => false,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users' as const,
      // Nullable — admin alerts have no associated customer
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'OTP', value: 'OTP' },
        { label: 'Booking Confirmed', value: 'Booking Confirmed' },
        { label: 'Booking Cancelled', value: 'Booking Cancelled' },
        { label: 'Payment Confirmed', value: 'Payment Confirmed' },
        { label: 'Reminder', value: 'Reminder' },
        { label: 'Tier Upgrade', value: 'Tier Upgrade' },
        { label: 'Free Slot Unlocked', value: 'Free Slot Unlocked' },
        { label: 'Referral Reward', value: 'Referral Reward' },
        { label: 'Review Thanks', value: 'Review Thanks' },
        { label: 'Cancellation Request Alert', value: 'Cancellation Request Alert' },
      ],
    },
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: [
        { label: 'WhatsApp', value: 'WhatsApp' },
        { label: 'Email', value: 'Email' },
      ],
    },
    {
      name: 'messageBody',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Sent',
      options: [
        { label: 'Sent', value: 'Sent' },
        { label: 'Failed', value: 'Failed' },
      ],
    },
    {
      name: 'sentAt',
      type: 'date',
    },
  ],
  timestamps: true,
}
