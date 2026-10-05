import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from './lib/supabase'

export default function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
      else if (data.session) { setSession(data.session); setPassword('') }
      else setError('Sign-in did not create a session. Please try again.')
    } catch {
      setError('Could not connect. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  if (checking) return <main className="login-page login-checking" aria-busy="true"><p role="status">Opening your workspace…</p></main>
  if (session) return children(session)

  return <main className="login-page">
    <section className="login-story" aria-label="About EIF Compass">
      <div className="login-brand"><span className="login-compass" aria-hidden="true"><svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="16" cy="16" r="13"/><path d="m22 10-4 8-8 4 4-8Z"/></svg></span><div><strong>eif compass</strong><span>INNOVATION FELLOWSHIP</span></div></div>
      <div className="login-story-copy"><h1>A clear direction.<br/>One step at a time.</h1><p>Your tasks, requirements, and fellowship moments—together in one workspace.</p><div className="login-features"><span><b>Keep your work moving</b></span><span><b>Stay close to what’s due</b></span><span><b>Grow with your team</b></span></div></div>
      <span className="login-story-footer">Small steps, meaningful progress.</span>
    </section>
    <section className="login-form-area">
      <div className="login-card"><h2>Sign in to your workspace</h2><p>Use your fellowship account to continue.</p>
        <form onSubmit={signIn} aria-busy={busy}>
          <label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy}/>
          <label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" disabled={busy}/>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {!supabase && <div className="auth-error" role="alert">Sign-in is currently unavailable. Please contact your fellowship lead.</div>}
          <button className="primary-button login-submit" disabled={busy || !supabase}>{busy ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">→</span></button>
        </form>
        <p className="login-help">Need an account or help signing in?<br/>Contact your fellowship lead.</p>
      </div><span className="login-footer">EIF COMPASS · YOUR FELLOWSHIP WORKSPACE</span>
    </section>
  </main>
}
