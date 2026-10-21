import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from './lib/supabase'
import './auth.css'

export default function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const client = supabase
    if (!client) { setChecking(false); return }
    let active = true
    let authEventReceived = false
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true
      if (!active) return
      setSession(nextSession)
      setChecking(false)
      setPassword('')
      setShowPassword(false)
    })
    void client.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return
      setSession(error ? null : data.session)
      if (error) setError('Could not restore your session. Please sign in again.')
      setChecking(false)
    }).catch(() => {
      if (!active || authEventReceived) return
      setError('Could not check your session. Please try signing in.')
      setChecking(false)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(error.message)
      else if (data.session) { setSession(data.session); setPassword(''); setShowPassword(false) }
      else setError('Sign-in did not create a session. Please try again.')
    } catch {
      setError('Could not connect. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  if (checking) return <main className="studio-login-checking" aria-busy="true"><p role="status">Opening your workspace…</p></main>
  if (session) return children(session)

  return <main className="studio-login">
    <section className="studio-login-story" aria-label="About EIF Compass">
      <div className="studio-login-brand"><img src="/compass-mark.svg" width="42" height="42" alt=""/><strong>eif compass</strong></div>
      <div className="studio-login-copy"><h1>Your next chapter<br/> starts with a<br/> <em>clear direction.</em></h1><p>A shared space for the work, ideas, and people that shape your fellowship.</p></div>
      <div className="studio-login-journey" aria-hidden="true"><svg viewBox="0 0 550 190" fill="none"><path d="M20 152H168L276 44H530" stroke="#7aaba4" strokeWidth="1.5"/><path d="M20 168H181L289 60H530M20 136H155L263 28H530" stroke="#7aaba4" strokeWidth="1" opacity=".35"/><circle cx="20" cy="152" r="7" fill="#b1d0c9"/><circle cx="168" cy="152" r="7" fill="var(--brand-deep)" stroke="#b1d0c9" strokeWidth="2"/><circle cx="276" cy="44" r="7" fill="var(--brand-deep)" stroke="#b1d0c9" strokeWidth="2"/><circle cx="530" cy="44" r="7" fill="#b1d0c9"/><path d="m276 22 6 10h-12l6-10Z" fill="#b1d0c9"/></svg><div><span>Find your focus</span><span>Build together</span><span>Move forward</span></div></div>
      <span className="studio-login-story-footer">Innovation Fellowship</span>
    </section>
    <section className="studio-login-form-area">
      <div className="studio-login-card"><h2>Welcome back.</h2><p>Sign in to your fellowship workspace.</p>
        <form onSubmit={signIn} aria-busy={busy}>
          <label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy}/>
          <label htmlFor="login-password">Password</label><div className="studio-login-password"><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" disabled={busy}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} disabled={busy} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide':'Show'}</button></div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {!supabase && <div className="auth-error" role="alert">Sign-in is currently unavailable. Please contact your fellowship lead.</div>}
          <button className="primary-button studio-login-submit" disabled={busy || !supabase}>{busy ? 'Signing in…' : 'Sign in'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        </form>
        <p className="studio-login-help">Need access or help signing in?<br/><strong>Contact your fellowship lead.</strong></p>
      </div><span className="studio-login-footer">Your fellowship, in focus.</span>
    </section>
  </main>
}
