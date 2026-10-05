import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, View } from './data'
import { supabase } from './lib/supabase'
import AuthGate from './AuthGate'
import WorkManager from './WorkManager'
import Dashboard from './Dashboard'

type IconName = 'home' | 'tasks' | 'check' | 'calendar' | 'bell' | 'search' | 'chevron' | 'arrow' | 'clock' | 'spark' | 'trend' | 'users' | 'flag' | 'plus' | 'dots' | 'lock' | 'close'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-7h6v7"/></>,
    tasks: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 .8.8L6 5M3.5 12l.8.8L6 11M3.5 18l.8.8L6 17"/></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 2.5 2.5L16 9"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    flag: <><path d="M5 21V4"/><path d="M5 4c5-4 9 4 14 0v10c-5 4-9-4-14 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function App() {
  return <AuthGate>{session => <Workspace key={session.user.id} session={session}/>}</AuthGate>
}

export function Workspace({ session }: { session: Session }) {
  const [role, setRole] = useState<Role | null>(null)
  const [view, setView] = useState<View>('overview')
  const [profile, setProfile] = useState<{ display_name?: string; role?: Role; team_name?: string; cohort_id?: string } | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [connected, setConnected] = useState(false)
  const [toast, setToast] = useState('')
  const [revision, setRevision] = useState(0)
  const [workspaceError, setWorkspaceError] = useState('')

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [])

  useEffect(() => {
    const navigate = (event: Event) => {
      const target = (event as CustomEvent<View>).detail
      if (target) setView(target)
    }
    const openWork = () => setView('work')
    window.addEventListener('set-view', navigate)
    window.addEventListener('open-work-view', openWork)
    return () => {
      window.removeEventListener('set-view', navigate)
      window.removeEventListener('open-work-view', openWork)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadWorkspace() {
      if (!supabase || !session?.user?.id) {
        setConnected(false)
        setProfile(null)
        setLoadingData(false)
        return
      }
      setLoadingData(true)
      setWorkspaceError('')
      setConnected(false)
      try {
        const { data: profileData, error: profileError } = await supabase.from('profiles').select('display_name,role,team_name,cohort_id').eq('id', session.user.id).maybeSingle()
        if (!active) return
        if (profileError) throw profileError
        if (!profileData) throw new Error('Your fellowship profile is missing. Ask your lead to finish your account setup.')
        setProfile(profileData)
        if (profileData.role !== 'lead' && profileData.role !== 'intern') throw new Error('Your profile has an unsupported role. Contact your fellowship lead.')
        setRole(profileData.role)

        setConnected(true)
      } catch (error) {
        if (!active) return
        setRole(null)
        setProfile(null)
        setWorkspaceError(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not load your workspace. Check that the Supabase schema and permissions are configured.')
      } finally {
        if (active) setLoadingData(false)
      }
    }
    void loadWorkspace()
    return () => { active = false }
  }, [session, revision])

  const activeNav: { id: View; label: string; icon: IconName }[] = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'work', label: role === 'lead' ? 'Cohort tasks' : 'My work', icon: 'tasks' },
    { id: 'requirements', label: 'Requirements', icon: 'check' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  ]
  const heading = view === 'overview' ? 'Overview' : view === 'work' ? (role === 'lead' ? 'Cohort tasks' : 'My work') : view === 'requirements' ? 'Requirements' : 'Calendar'
  const displayName = profile?.display_name || 'EIF Fellow'

  async function signOut() {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) setToast('Could not sign out. Please try again.')
    } catch {
      setToast('Could not sign out. Please try again.')
    }
  }

  if (role === null) return <main className="login-page login-checking"><section className="login-card"><h1>{loadingData ? 'Loading your workspace…' : 'Workspace unavailable'}</h1>{workspaceError && <p role="alert">{workspaceError}</p>}{!loadingData && <div className="manager-actions"><button className="primary-button" onClick={() => setRevision(value => value + 1)}>Retry</button><button className="text-button" onClick={() => void signOut()}>Sign out</button></div>}</section></main>

  return (
    <div className={`app-shell workspace-${role}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><CompassMark /></div><div><strong>eif compass</strong><span>INNOVATION FELLOWSHIP</span></div></div>
        <div className="cohort-switch"><span className="cohort-dot"/><span>Fellowship workspace</span><Icon name="chevron" size={15}/></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {activeNav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'selected' : ''}`} onClick={() => setView(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}
        </nav>
        <div className="side-spacer"/>
        <button className="profile-card" onClick={() => void signOut()} title="Sign out" aria-label="Sign out"><div className="avatar avatar-lilac">{initials(displayName)}</div><div className="profile-info"><strong>{displayName}</strong><span>Sign out</span></div><Icon name="dots" size={16}/></button>
        <div className="sidebar-foot"><span className="live-dot"/> Your fellowship, in focus</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>EIF Compass</span><span className="crumb-slash">/</span><strong>{heading}</strong></div>
          <div className="top-actions">
            <div className="top-divider"/>
            <button className="mini-profile" onClick={() => void signOut()} aria-label="Sign out"><div className="avatar avatar-lilac">{initials(displayName)}</div><Icon name="chevron" size={14}/></button>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div><div className="eyebrow">{new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="eyebrow-line"/></div><h1>{view === 'overview' ? `Welcome, ${displayName.split(' ')[0]}.` : heading}<span className="heading-period">{view === 'overview' ? ' ✦' : ''}</span></h1><p>{role === 'lead' ? 'Here’s how your cohort is moving this week.' : 'A clear view of your fellowship, all in one place.'}</p></div>
            <div className="heading-actions"><span className="data-pill">{role === 'lead' ? 'Lead workspace' : 'Intern workspace'}</span><button className="text-button" onClick={() => setRevision(value => value + 1)}>Refresh workspace</button><div className={`data-pill ${connected ? 'is-connected' : ''}`}><span className="data-dot"/>{connected ? 'Profile verified' : (loadingData ? 'Loading workspace…' : 'Workspace unavailable')}</div><button className="primary-button" onClick={() => role === 'lead' ? setView('work') : setView('requirements')}><Icon name={role === 'lead' ? 'tasks' : 'check'} size={16}/>{role === 'lead' ? 'View team tasks' : 'View requirements'}</button></div>
          </div>

          {supabase && profile?.cohort_id ? view === 'overview' ? <Dashboard client={supabase} role={role} userId={session.user.id} cohortId={profile.cohort_id} revision={revision} onNavigate={setView}/> : <WorkManager key={view} client={supabase} role={role} view={view} userId={session.user.id} cohortId={profile.cohort_id} onChanged={() => setRevision(v => v + 1)}/> : <section className="panel" role="alert">Your account has no cohort assigned. Contact your fellowship lead.</section>}

          <footer className="page-footer"><span>EIF COMPASS <span className="footer-sep">·</span> FELLOWSHIP COHORT 2026</span><span>Small steps, meaningful progress.</span></footer>
        </div>
      </main>

      {toast && <div className="toast"><span className="toast-check">✓</span>{toast}</div>}

    </div>
  )
}

function initials(name: string) { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() }

function CompassMark() { return <svg viewBox="0 0 40 40" className="compass-svg" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m25.8 14.2-3.6 8-8 3.6 3.6-8 8-3.6Z" fill="currentColor"/><circle cx="20" cy="20" r="1.4" fill="var(--brand-deep)"/><path d="M20 3v4M37 20h-4M20 37v-4M3 20h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
