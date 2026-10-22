import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { supabase } from './lib/supabase'
import CompassLogo from './CompassLogo'
import ThemeToggle from './ThemeToggle'
import { reducedMotion } from './motion'
import { REST, journeyTargets, nearestOnPath, pathD, stepToward } from './journey'
import type { Pt } from './journey'
import './auth.css'

const GHOST_A = { x: 13, y: 16 }, GHOST_B = { x: -13, y: -16 }
const SHAKE: Keyframe[] = [{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'none' }]

export default function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [arrival, setArrival] = useState<Pt | null>(null)
  // Where the arrival overlay opens from; set on submit so a restored session never plays it.
  const arrivalFrom = useRef<Pt | null>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const openArrival = () => { const from = arrivalFrom.current; arrivalFrom.current = null; if (from) setArrival(from) }

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
      if (nextSession) openArrival()
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

  useEffect(() => { if (!arrival) return; const timer = window.setTimeout(() => setArrival(null), 1600); return () => window.clearTimeout(timer) }, [arrival])
  useEffect(() => { if (error && !reducedMotion()) formRef.current?.querySelectorAll('input').forEach(input => input.animate?.(SHAKE, { duration: 400, easing: 'cubic-bezier(.23,1,.32,1)' })) }, [error])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    const box = submitRef.current?.getBoundingClientRect()
    arrivalFrom.current = box && !reducedMotion() ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) { arrivalFrom.current = null; setError(error.message) }
      else if (data.session) { setSession(data.session); setPassword(''); setShowPassword(false); openArrival() }
      else { arrivalFrom.current = null; setError('Sign-in did not create a session. Please try again.') }
    } catch {
      arrivalFrom.current = null
      setError('Could not connect. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  if (checking) return <main className="login-page studio-login-checking" aria-busy="true"><section className="login-card" role="status"><h1>Opening your workspace…</h1></section></main>
  if (session) return <>{children(session)}{arrival && <div className="arrival" aria-hidden="true" style={{ '--sx': `${arrival.x}px`, '--sy': `${arrival.y}px` } as CSSProperties}><div><CompassLogo size={64} animate/><p>Opening your workspace…</p></div></div>}</>

  return <main className="studio-login">
    <section className="studio-login-story" aria-label="About EIF Compass">
      <div className="studio-login-aurora" aria-hidden="true"><i/><i/></div>
      <div className="studio-login-brand"><CompassLogo size={44} animate/><strong>eif compass</strong></div>
      <div className="studio-login-copy"><h1><span className="ln"><span>Your next chapter</span></span>{' '}<span className="ln"><span>starts with a</span></span>{' '}<span className="ln"><span><em>clear direction.</em></span></span></h1><p>A shared space for the work, ideas, and people that shape your fellowship.</p></div>
      <div className="studio-login-journey" aria-hidden="true"><Journey/><div><span>Find your focus</span><span>Build together</span><span>Move forward</span></div></div>
      <span className="studio-login-story-footer">Innovation Fellowship</span>
    </section>
    <section className="studio-login-form-area">
      <div className="studio-login-card"><h2>Welcome back.</h2><p>Sign in to your fellowship workspace.</p>
        <form ref={formRef} onSubmit={signIn} aria-busy={busy}>
          <label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy}/>
          <label htmlFor="login-password">Password</label><div className="studio-login-password"><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" disabled={busy}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} disabled={busy} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide':'Show'}</button></div>
          {error && <div className="auth-error" role="alert"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 17h.01"/></svg><span>{error}</span></div>}
          {!supabase && <div className="auth-error" role="alert">Sign-in is currently unavailable. Please contact your fellowship lead.</div>}
          <button ref={submitRef} className="primary-button studio-login-submit" disabled={busy || !supabase}>{busy ? 'Signing in…' : 'Sign in'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        </form>
        <p className="studio-login-help">Need access or help signing in?<br/><strong>Contact your fellowship lead.</strong></p>
      </div><span className="studio-login-footer">Your fellowship, in focus.</span>
    </section>
    <div className="studio-login-theme"><ThemeToggle/></div>
  </main>
}

/** The three-step journey line: draws itself on mount, then leans toward a fine pointer over the story panel. */
function Journey() {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = svgRef.current, story = svg?.closest<HTMLElement>('.studio-login-story')
    if (!svg || !story) return
    const get = (selector: string) => svg.querySelector(selector) as SVGElement
    const main = get('.journey-main'), ghostA = get('.journey-ghost-a'), ghostB = get('.journey-ghost-b'), mark = get('.journey-mark'), ping = get('.journey-ping'), light = get('.journey-light')
    const nodes = [...svg.querySelectorAll<SVGCircleElement>('.journey-node')]
    const reduce = reducedMotion()
    let live = false, frame = 0, pointer: Pt | null = null, box: DOMRect | null = null
    let line = REST, ghost = REST, glow: Pt = REST[3]
    const n = (v: number) => String(+v.toFixed(2))
    const at = (el: Element, p: Pt) => { el.setAttribute('cx', n(p.x)); el.setAttribute('cy', n(p.y)) }
    const tick = () => {
      frame = 0
      const a = stepToward(line, journeyTargets(pointer)), b = stepToward(ghost, journeyTargets(pointer, 14))
      line = a.points; ghost = b.points
      const c = stepToward([glow], [pointer ? nearestOnPath(line, pointer.x) : line[3]])
      glow = c.points[0]
      main.setAttribute('d', pathD(line)); ghostA.setAttribute('d', pathD(ghost, GHOST_A)); ghostB.setAttribute('d', pathD(ghost, GHOST_B))
      nodes.forEach((node, i) => at(node, line[i])); at(ping, line[3]); at(light, glow)
      mark.setAttribute('d', `M${n(line[2].x)} ${n(line[2].y - 22)}l6 10h-12Z`)
      if (!(a.settled && b.settled && c.settled)) frame = window.requestAnimationFrame(tick)
    }
    const kick = () => { if (live && !frame) frame = window.requestAnimationFrame(tick) }
    // The intro (path draw, travelling light, node pops) owns the line for its first 2.8s.
    const timer = window.setTimeout(() => { live = true; at(light, REST[3]); svg.classList.add('is-live'); kick() }, reduce ? 0 : 2800)
    let fine = false
    try { fine = !reduce && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true } catch { /* no matchMedia */ }
    if (!fine) return () => window.clearTimeout(timer)
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      box ??= svg.getBoundingClientRect()
      if (!box.width || !box.height) return
      pointer = { x: (event.clientX - box.left) / box.width * 550, y: (event.clientY - box.top) / box.height * 190 }
      kick()
    }
    const leave = () => { pointer = null; box = null; kick() }
    const stale = () => { box = null }
    story.addEventListener('pointermove', move); story.addEventListener('pointerleave', leave)
    window.addEventListener('resize', stale); window.addEventListener('scroll', stale, { capture: true, passive: true })
    return () => {
      window.clearTimeout(timer); window.cancelAnimationFrame(frame)
      story.removeEventListener('pointermove', move); story.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', stale); window.removeEventListener('scroll', stale, { capture: true })
    }
  }, [])
  // pathLength=1 keeps the draw-on dash correct however far the line bends.
  return <svg ref={svgRef} viewBox="0 0 550 190" fill="none">
    <path className="journey-ghost journey-ghost-a" d={pathD(REST, GHOST_A)} pathLength={1} strokeWidth="1"/>
    <path className="journey-ghost journey-ghost-b" d={pathD(REST, GHOST_B)} pathLength={1} strokeWidth="1"/>
    <path className="journey-main" d={pathD(REST)} pathLength={1} strokeWidth="1.5"/>
    <circle className="journey-node" style={{ animationDelay: '.7s' }} cx="20" cy="152" r="7"/>
    <circle className="journey-node is-hollow" style={{ animationDelay: '1.3s' }} cx="168" cy="152" r="7" strokeWidth="2"/>
    <circle className="journey-node is-hollow" style={{ animationDelay: '1.9s' }} cx="276" cy="44" r="7" strokeWidth="2"/>
    <path className="journey-mark" style={{ animationDelay: '1.9s' }} d="M276 22l6 10h-12Z"/>
    <circle className="journey-ping" cx="530" cy="44" r="7"/>
    <circle className="journey-node is-end" style={{ animationDelay: '2.8s' }} cx="530" cy="44" r="7"/>
    <circle className="journey-light" r="4"/>
  </svg>
}
