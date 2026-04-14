'use client'

import React, { useEffect, useState } from 'react'

interface UserData {
  id: number
  fullName: string
  mobileNumber?: string
  whatsappNumber?: string
  currentTier: string
  loyaltyPointsBalance: number
  referralCode?: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { user?: UserData }) => {
        if (d.user) {
          setUser(d.user)
          setFullName(d.user.fullName)
          setWhatsappNumber(d.user.whatsappNumber ?? d.user.mobileNumber ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setError(null)
    setSuccess(false)
    if (!fullName.trim()) { setError('Full name is required'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/users/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: fullName.trim(),
          whatsappNumber: whatsappNumber.trim(),
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-32 bg-muted rounded" /><div className="h-48 bg-muted rounded-xl" /></div>
  if (!user) return null

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">My Profile</h1>

      {/* Read-only info */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {[
          ['Mobile Number', user.mobileNumber ?? '—'],
          ['Referral Code', user.referralCode ?? '—'],
          ['Current Tier', user.currentTier],
          ['Loyalty Points', user.loyaltyPointsBalance.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Editable fields */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <p className="text-sm font-semibold">Edit Details</p>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Full Name</label>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">WhatsApp Number</label>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="e.g. 923001234567"
            type="tel"
          />
          <p className="text-xs text-muted-foreground">This number receives booking notifications.</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-800 dark:text-green-200">
            ✅ Profile updated successfully.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
