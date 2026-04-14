import Link from 'next/link'
import React from 'react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4">

      {/* Logo mark */}
      <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-8">
        <span className="text-white text-xl font-bold">AW</span>
      </div>

      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-bold text-center leading-tight">
        Alpha Wheels
      </h1>
      <p className="mt-3 text-lg text-white/60 text-center max-w-sm">
        Professional car detailing &amp; PPF services in Lahore
      </p>

      {/* CTA */}
      <Link
        href="/booking"
        className="mt-10 inline-block bg-white text-slate-900 font-semibold text-sm px-8 py-3 rounded-full hover:bg-white/90 transition-colors"
      >
        Book a Service
      </Link>

      {/* Secondary links */}
      <div className="mt-6 flex gap-6 text-sm text-white/40">
        <Link href="/my/dashboard" className="hover:text-white/70 transition-colors">
       View Dashboard
        </Link>
        {/* <Link href="/dashboard" className="hover:text-white/70 transition-colors">
          Admin
        </Link> */}
      </div>
    </div>
  )
}