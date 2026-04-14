'use client'

import React, { useCallback, useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: number
  serviceName: string
  slug?: string | null
}

interface ServiceVariant {
  id: number
  service: number | Service
  carType: string
  location: string
  price: number
  durationMinutes: number
}

interface SlotItem {
  id: number
  startTime: string
  endTime: string
  date: string
}

interface BankDetails {
  bankName?: string | null
  accountTitle?: string | null
  accountNumber?: string | null
  iban?: string | null
  instructions?: string | null
}

type Step = 'form' | 'otp' | 'slots' | 'confirm' | 'done'

interface Props {
  prefilledServiceSlug: string | null
  prefilledCarType: string | null
  prefilledLocation: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function formatPrice(pkr: number): string {
  return `PKR ${pkr.toLocaleString()}`
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDuration(minutes: number): string {
  if (minutes <= 60) return '1 hour'
  const lower = Math.floor(minutes / 60)
  const upper = lower + 1
  return `${lower}–${upper} hours (approx)`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingFlow({ prefilledServiceSlug, prefilledCarType, prefilledLocation }: Props) {
  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form')

  // ── Service/variant state ───────────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([])
  const [variants, setVariants] = useState<ServiceVariant[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [selectedCarType, setSelectedCarType] = useState<string>(prefilledCarType ?? '')
  const [selectedLocation, setSelectedLocation] = useState<string>(prefilledLocation ?? '')
  const [matchedVariant, setMatchedVariant] = useState<ServiceVariant | null>(null)

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carYear, setCarYear] = useState('')
  const [carColor, setCarColor] = useState('')
  const [doorstepAddress, setDoorstepAddress] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)

  // ── OTP state ───────────────────────────────────────────────────────────────
  const [otp, setOtp] = useState('')

  // ── Slot state ──────────────────────────────────────────────────────────────
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotItem[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [slotMonth, setSlotMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // ── Payment state ───────────────────────────────────────────────────────────
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [bankRef, setBankRef] = useState('')

  // ── UI state ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingRef, setBookingRef] = useState<string | null>(null)

  // ── Fetch services on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/payload-proxy/services?limit=100&where[isActive][equals]=true')
      .then((r) => r.json())
      .then((data: { docs?: Service[] }) => {
        const docs = data.docs ?? []
        setServices(docs)

        // Auto-select if prefilled slug matches
        if (prefilledServiceSlug && docs.length > 0) {
          const match = docs.find(
            (s) =>
              slugify(s.serviceName) === prefilledServiceSlug ||
              s.serviceName.toLowerCase() === prefilledServiceSlug.toLowerCase(),
          )
          if (match) setSelectedServiceId(match.id)
        }
      })
      .catch(() => {/* non-fatal */})
  }, [prefilledServiceSlug])

  // ── Fetch variants when service selected ───────────────────────────────────
  useEffect(() => {
    if (!selectedServiceId) { setVariants([]); setMatchedVariant(null); return }

    fetch(`/api/payload-proxy/service-variants?limit=100&where[service][equals]=${selectedServiceId}`)
      .then((r) => r.json())
      .then((data: { docs?: ServiceVariant[] }) => setVariants(data.docs ?? []))
      .catch(() => {/* non-fatal */})
  }, [selectedServiceId])

  // ── Match variant whenever car type, location or variants change ───────────
  useEffect(() => {
    if (!selectedCarType || !selectedLocation || variants.length === 0) {
      setMatchedVariant(null)
      return
    }

    // CrossOver and MPV share the same variant (CrossOver)
    const normalizedCar =
      selectedCarType === 'MPV' ? 'CrossOver' : selectedCarType

    const match = variants.find(
      (v) =>
        v.carType === normalizedCar &&
        v.location === selectedLocation,
    )
    setMatchedVariant(match ?? null)
  }, [selectedCarType, selectedLocation, variants])

  // ── Fetch available dates for current month ─────────────────────────────────
  const fetchAvailableDates = useCallback(async (month: string) => {
    try {
      const res = await fetch('/api/slots/available', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ month }),
      })
      const data = (await res.json()) as { availableDates?: string[]; error?: string }
      if (res.ok) setAvailableDates(data.availableDates ?? [])
    } catch {/* non-fatal */}
  }, [])

  useEffect(() => {
    if (step === 'slots') fetchAvailableDates(slotMonth)
  }, [step, slotMonth, fetchAvailableDates])

  // ── Fetch time slots for selected date ─────────────────────────────────────
  useEffect(() => {
    if (!selectedDate) { setSlots([]); return }

    fetch(`/api/slots/available?date=${selectedDate}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { slots?: SlotItem[] }) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
  }, [selectedDate])

  // ── Fetch bank details ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 'confirm') {
      fetch('/api/booking-settings')
        .then((r) => r.json())
        .then((data: { bankAccountDetails?: BankDetails }) => {
          setBankDetails(data.bankAccountDetails ?? null)
        })
        .catch(() => {/* non-fatal */})
    }
  }, [step])

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSendOtp() {
    setError(null)
    if (!mobileNumber || !/^\d{10,15}$/.test(mobileNumber)) {
      setError('Enter a valid mobile number (digits only, e.g. 923001234567)')
      return
    }
    if (!fullName.trim()) { setError('Please enter your full name'); return }
    if (!carModel.trim()) { setError('Please enter your car model'); return }
    if (!carYear.trim()) { setError('Please enter your car year'); return }
    if (!carColor.trim()) { setError('Please enter your car color'); return }
    if (!matchedVariant) { setError('Please select a valid service, car type and location'); return }
    if (selectedLocation === 'Doorstep' && !doorstepAddress.trim()) {
      setError('Please enter your doorstep address'); return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber, fullName: fullName.trim(), ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}) }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to send OTP'); return }
      setStep('otp')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setError(null)
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code sent to your WhatsApp'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mobileNumber, otp }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Invalid OTP'); return }
      setStep('slots')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmBooking() {
    if (!selectedSlotId || !matchedVariant) return
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          serviceVariantId: matchedVariant.id,
          slotId: selectedSlotId,
          carModel,
          carYear,
          carColor,
          location: selectedLocation,
          ...(selectedLocation === 'Doorstep' ? { doorstepAddress } : {}),
          paymentMethod: 'Bank Transfer',
          ...(bankRef.trim() ? { bankTransferReferenceNumber: bankRef.trim() } : {}),
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        booking?: { bookingReference?: string; finalPrice?: number }
        bankAccountDetails?: BankDetails | null
      }
      if (!res.ok) { setError(data.error ?? 'Failed to create booking'); return }
      setBookingRef(data.booking?.bookingReference ?? null)
      // Use bank details from booking response if not already loaded
      if (data.bankAccountDetails && !bankDetails) {
        setBankDetails(data.bankAccountDetails)
      }
      setStep('done')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Geolocation ──────────────────────────────────────────────────────────────
  function handleGeolocate() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`
        setDoorstepAddress(mapsLink)
        setGeoLoading(false)
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          alert('Location access was denied. Please allow location access in your browser settings and try again.')
        } else {
          alert('Could not get your location. Please enter the address manually.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

    // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null

  // Car types and locations come entirely from fetched variants — no hardcoding.
  // If the admin adds or removes a car type or location in the CMS, the UI
  // updates automatically without any frontend code change.
  const CAR_TYPES: string[] = Array.from(
    new Set(variants.map((v) => v.carType))
  ).sort()

  const LOCATIONS: string[] = Array.from(
    new Set(variants.map((v) => v.location))
  ).sort()

  // Display label for CrossOver — show "CrossOver / MPV" to the user when
  // both CrossOver and MPV map to the same DB variant, but only if MPV
  // variants actually exist in the fetched data alongside CrossOver.
  // Otherwise just show the raw DB value.
  function carTypeDisplayLabel(dbValue: string): string {
    if (dbValue === 'CrossOver') {
      const hasMpv = variants.some((v) => v.carType === 'MPV')
      return hasMpv ? 'CrossOver / MPV' : 'CrossOver'
    }
    return dbValue
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">AW</span>
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">Alpha Wheels</p>
            <p className="text-muted-foreground text-xs mt-0.5">Book a Service</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ── STEP: FORM ── */}
        {step === 'form' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Book Your Service</h1>
              <p className="text-muted-foreground text-sm mt-1">Fill in your details below to get started.</p>
            </div>

            {/* Service selection */}
            <Section title="Service Details">
              <Field label="Service">
                <select
                  className={inputCls}
                  value={selectedServiceId ?? ''}
                  onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select a service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.serviceName}</option>
                  ))}
                </select>
              </Field>

              <Field label="Car Type">
                <select
                  className={inputCls}
                  value={selectedCarType}
                  onChange={(e) => setSelectedCarType(e.target.value)}
                >
                  <option value="">Select car type</option>
                  {CAR_TYPES.map((dbValue) => (
                    <option key={dbValue} value={dbValue}>
                      {carTypeDisplayLabel(dbValue)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Location">
                {LOCATIONS.length > 0 ? (
                  <div className="flex gap-3">
                    {LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setSelectedLocation(loc)}
                        className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                          selectedLocation === loc
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-accent'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedServiceId ? 'No locations available for this service.' : 'Select a service first.'}
                  </p>
                )}
              </Field>
            </Section>

            {/* Price pill */}
            {matchedVariant && (
              <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Service Price</p>
                  <p className="text-xl font-bold">{formatPrice(matchedVariant.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium text-sm">{formatDuration(matchedVariant.durationMinutes)}</p>
                </div>
              </div>
            )}

            {/* Personal details */}
            <Section title="Your Details">
              <Field label="Full Name">
                <input
                  className={inputCls}
                  placeholder="e.g. Ahmed Khan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field label="WhatsApp Number">
                <input
                  className={inputCls}
                  placeholder="e.g. 923001234567"
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-muted-foreground mt-1">Digits only, include country code e.g. 92300…</p>
              </Field>
              <Field label="Referral Code (optional)">
                <input
                  className={inputCls}
                  placeholder="e.g. REF-AB1C2"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={9}
                />
                <p className="text-xs text-muted-foreground mt-1">Have a referral code? Enter it here to get a discount on your next booking.</p>
              </Field>
            </Section>

            {/* Car details */}
            <Section title="Car Details">
              <Field label="Car Model">
                <input
                  className={inputCls}
                  placeholder="e.g. Honda Civic"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year">
                  <input
                    className={inputCls}
                    placeholder="e.g. 2021"
                    value={carYear}
                    onChange={(e) => setCarYear(e.target.value)}
                    maxLength={4}
                  />
                </Field>
                <Field label="Color">
                  <input
                    className={inputCls}
                    placeholder="e.g. White"
                    value={carColor}
                    onChange={(e) => setCarColor(e.target.value)}
                  />
                </Field>
              </div>
              {selectedLocation === 'Doorstep' && (
                <Field label="Doorstep Address">
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      placeholder="Full pickup address or use location pin"
                      value={doorstepAddress}
                      onChange={(e) => setDoorstepAddress(e.target.value)}
                    />
                    <button
                      type="button"
                      title="Use my current location"
                      onClick={handleGeolocate}
                      disabled={geoLoading}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {geoLoading ? (
                        <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3" />
                          <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                          <circle cx="12" cy="12" r="9" strokeDasharray="2 4" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Type your address, or tap{' '}
                    <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                      <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                      </svg>{' '}
                      the pin icon
                    </span>{' '}
                    to share your live location. You&apos;ll be asked to allow location access.
                  </p>
                  {doorstepAddress.startsWith('https://www.google.com/maps') && (
                    <a
                      href={doorstepAddress}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Preview location in Google Maps
                    </a>
                  )}
                </Field>
              )}
            </Section>

            {error && <ErrorBox message={error} />}

            <button
              onClick={handleSendOtp}
              disabled={loading || !matchedVariant}
              className={primaryBtn}
            >
              {loading ? 'Sending OTP…' : 'Continue — Get OTP'}
            </button>

            {!matchedVariant && selectedServiceId && selectedCarType && selectedLocation && (
              <p className="text-sm text-center text-muted-foreground">
                No variant found for this combination. Please contact us.
              </p>
            )}
          </div>
        )}

        {/* ── STEP: OTP ── */}
        {step === 'otp' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Verify Your Number</h1>
              <p className="text-muted-foreground text-sm mt-1">
                We sent a 6-digit code to <span className="font-medium text-foreground">{mobileNumber}</span> on WhatsApp.
              </p>
            </div>

            <Section title="Enter OTP">
              <Field label="6-Digit Code">
                <input
                  className={`${inputCls} tracking-widest text-center text-lg font-bold`}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  type="tel"
                  autoFocus
                />
              </Field>
            </Section>

            {error && <ErrorBox message={error} />}

            <button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6} className={primaryBtn}>
              {loading ? 'Verifying…' : 'Verify & Choose Slot'}
            </button>

            <button
              onClick={() => { setStep('form'); setOtp(''); setError(null) }}
              className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
            >
              ← Change number
            </button>
          </div>
        )}

        {/* ── STEP: SLOTS ── */}
        {step === 'slots' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Choose a Slot</h1>
              <p className="text-muted-foreground text-sm mt-1">Select an available date and time.</p>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const [y, m] = slotMonth.split('-').map(Number)
                  const prev = new Date(y, m - 2, 1)
                  const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
                  setSlotMonth(key)
                  setSelectedDate(null)
                }}
                className="px-3 py-1 rounded-md border border-border text-sm hover:bg-accent"
              >
                ‹ Prev
              </button>
              <p className="font-medium text-sm">
                {new Date(`${slotMonth}-01`).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => {
                  const [y, m] = slotMonth.split('-').map(Number)
                  const next = new Date(y, m, 1)
                  const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
                  setSlotMonth(key)
                  setSelectedDate(null)
                }}
                className="px-3 py-1 rounded-md border border-border text-sm hover:bg-accent"
              >
                Next ›
              </button>
            </div>

            {/* Available dates */}
            {availableDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No available dates this month.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableDates.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedDate(d); setSelectedSlotId(null) }}
                    className={`py-2 px-2 rounded-md border text-xs font-medium transition-colors ${
                      selectedDate === d
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {formatDate(d)}
                  </button>
                ))}
              </div>
            )}

            {/* Time slots */}
            {selectedDate && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Available times on {formatDate(selectedDate)}</p>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No slots available for this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSlotId(s.id)}
                        className={`py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                          selectedSlotId === s.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <ErrorBox message={error} />}

            <button
              onClick={() => { if (selectedSlotId) setStep('confirm') }}
              disabled={!selectedSlotId}
              className={primaryBtn}
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === 'confirm' && matchedVariant && selectedSlot && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Confirm & Pay</h1>
              <p className="text-muted-foreground text-sm mt-1">Review your booking and complete payment.</p>
            </div>

            {/* Booking summary */}
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {[
                ['Service', services.find((s) => s.id === selectedServiceId)?.serviceName ?? '—'],
                ['Car Type', selectedCarType],
                ['Location', selectedLocation],
                ['Date', formatDate(selectedSlot.date)],
                ['Time', `${selectedSlot.startTime} – ${selectedSlot.endTime}`],
                ['Car', `${carModel} ${carYear} (${carColor})`],
                ['Amount', formatPrice(matchedVariant.price)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Bank details */}
            {bankDetails && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <p className="font-semibold text-sm">Bank Transfer Details</p>
                {bankDetails.bankName && <DetailRow label="Bank" value={bankDetails.bankName} />}
                {bankDetails.accountTitle && <DetailRow label="Account Title" value={bankDetails.accountTitle} />}
                {bankDetails.accountNumber && <DetailRow label="Account No." value={bankDetails.accountNumber} />}
                {bankDetails.iban && <DetailRow label="IBAN" value={bankDetails.iban} />}
                {bankDetails.instructions && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    {bankDetails.instructions}
                  </p>
                )}
              </div>
            )}

            {/* Reference number input */}
            <Field label="Transfer Reference Number (optional)">
              <input
                className={inputCls}
                placeholder="Paste your bank transfer reference"
                value={bankRef}
                onChange={(e) => setBankRef(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can also send the receipt to our WhatsApp after booking.
              </p>
            </Field>

            {error && <ErrorBox message={error} />}

            <button onClick={handleConfirmBooking} disabled={loading} className={primaryBtn}>
              {loading ? 'Confirming…' : 'Confirm Booking'}
            </button>

            <button
              onClick={() => setStep('slots')}
              className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
            >
              ← Change slot
            </button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Booking Received!</h1>
              <p className="text-muted-foreground text-sm mt-2">
                We&apos;ve sent a confirmation to your WhatsApp.
              </p>
              {bookingRef && (
                <div className="mt-4 inline-block bg-card border border-border rounded-lg px-5 py-3">
                  <p className="text-xs text-muted-foreground">Booking Reference</p>
                  <p className="text-lg font-bold tracking-wider">{bookingRef}</p>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Your booking is <span className="font-medium text-foreground">Pending</span> until payment is confirmed by our team.
            </p>
            {bankDetails && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-left">
                <p className="font-semibold text-sm">Complete Your Bank Transfer</p>
                {bankDetails.bankName && <DetailRow label="Bank" value={bankDetails.bankName} />}
                {bankDetails.accountTitle && <DetailRow label="Account Title" value={bankDetails.accountTitle} />}
                {bankDetails.accountNumber && <DetailRow label="Account No." value={bankDetails.accountNumber} />}
                {bankDetails.iban && <DetailRow label="IBAN" value={bankDetails.iban} />}
                {bankDetails.instructions && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">{bankDetails.instructions}</p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Small reusable UI pieces ─────────────────────────────────────────────────

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50'

const primaryBtn =
  'w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md py-2.5 px-4 text-sm font-medium transition-colors'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  )
}
