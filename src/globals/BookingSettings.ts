import type { GlobalConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const BookingSettings: GlobalConfig = {
  slug: 'booking-settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'autoApproveBankTransfer',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Auto-approve bookings when a bank transfer payment is confirmed',
            width: '50%',
          },
        },
        {
          name: 'autoApproveOnlinePayment',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Auto-approve bookings when an online payment is confirmed',
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'defaultReferralVoucherPercent',
          type: 'number',
          defaultValue: 10,
          admin: {
            description: 'Discount % for referral reward vouchers',
            width: '50%',
          },
        },
        {
          name: 'voucherExpiryDays',
          type: 'number',
          defaultValue: 30,
          admin: {
            description: 'Days until a newly issued voucher expires',
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'slotIntervalMinutes',
          type: 'number',
          defaultValue: 60,
          admin: {
            description: 'Default slot duration used by slot generator',
            width: '50%',
          },
        },
        {
          name: 'reminderHoursBefore',
          type: 'number',
          defaultValue: 24,
          admin: {
            description: 'Hours before appointment to send WhatsApp reminder',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'reviewTokenExpiryMinutes',
      type: 'number',
      defaultValue: 2880,
      admin: {
        description: 'Minutes until a review token expires (default 2880 = 48 hours)',
      },
    },
    {
      name: 'loyaltyPointsMultipliers',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'beginnerMultiplier',
              type: 'number',
              defaultValue: 1,
              admin: { width: '33%' },
            },
            {
              name: 'goldMultiplier',
              type: 'number',
              defaultValue: 1.5,
              admin: { width: '33%' },
            },
            {
              name: 'platinumMultiplier',
              type: 'number',
              defaultValue: 2,
              admin: { width: '33%' },
            },
          ],
        },
      ],
    },
    {
      name: 'bankAccountDetails',
      type: 'group',
      admin: {
        description: 'Shown to customers at bank transfer checkout',
      },
      fields: [
        {
          name: 'bankName',
          type: 'text',
        },
        {
          name: 'accountTitle',
          type: 'text',
        },
        {
          name: 'accountNumber',
          type: 'text',
        },
        {
          name: 'iban',
          type: 'text',
          admin: {
            description: 'IBAN format e.g. PK36SCBL0000001123456702',
          },
        },
        {
          name: 'instructions',
          type: 'text',
          admin: {
            description: 'Additional payment instructions shown to customer',
          },
        },
      ],
    },
  ],
}
