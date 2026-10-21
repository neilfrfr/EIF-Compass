import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, View } from './data'
import { supabase } from './lib/supabase'
import AuthGate from './AuthGate'
import WorkManager from './WorkManager'
import Dashboard from './Dashboard'
import Assistant from './Assistant'
import type {DashboardExplanation} from './Assistant'
import GoogleCalendar from './GoogleCalendar'
import Agenda from './Agenda'
import InternFlows from './InternFlows'

type IconName = 'home' | 'tasks' | 'check' | 'calendar' | 'bell' | 'search' | 'chevron' | 'arrow' | 'clock' | 'spark' | 'trend' | 'users' | 'flag' | 'plus' | 'dots' | 'lock' | 'close' | 'feedback' | 'blocker' | 'menu'

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
    feedback: <><path d="M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M7 8h10M7 12h7"/></>,
    blocker: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function App() {
  return <AuthGate>{session => <Workspace key={session.user.id} session={session}/>}</AuthGate>
}

export function Workspace({ session }: { session: Session }) {
  const [assistantExplanation,setAssistantExplanation]=useState<(DashboardExplanation&{scope:string})|null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [view, setView] = useState<View>(()=>new URLSearchParams(window.location.search).has('google')?'calendar':'overview')
  useEffect(()=>{if(view!=='assistant')setAssistantExplanation(null)},[view])
  const [profile, setProfile] = useState<{ display_name?: string; role?: Role; team_name?: string; cohort_id?: string } | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [, setConnected] = useState(false)
  const [cohortName, setCohortName] = useState('Your fellowship')
  const [focusedRecordId, setFocusedRecordId] = useState<string>()
  const navigationDialog = useRef<HTMLDialogElement>(null)
  const navigationAnimation = useRef<Animation | null>(null)
  const navigationClosing = useRef(false)
  const pageTitle = useRef<HTMLHeadingElement>(null)
  const [toast, setToast] = useState('')
  const [revision, setRevision] = useState(0)
  const [workspaceError, setWorkspaceError] = useState('')
  const [showSync, setShowSync] = useState(() => new URLSearchParams(window.location.search).has('google'))
  const [showEventManager, setShowEventManager] = useState(false)

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
      if (target) { setFocusedRecordId(undefined); setView(target) }
    }
    const openWork = () => { setFocusedRecordId(undefined); setView('work') }
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

  useEffect(() => {
    let active = true
    setCohortName('Your fellowship')
    if (supabase && profile?.cohort_id) void supabase.from('cohorts').select('name').eq('id', profile.cohort_id).maybeSingle().then(({data}) => { if (active && data?.name) setCohortName(data.name) })
    return () => { active = false }
  }, [profile?.cohort_id])
  useEffect(() => () => navigationAnimation.current?.cancel(), [])

  function openNavigation(instant = false) {
    const dialog = navigationDialog.current
    if (!dialog) return
    navigationAnimation.current?.cancel()
    navigationClosing.current = false
    delete dialog.dataset.closing
    if (!dialog.open) dialog.showModal()
    const panel = dialog.querySelector<HTMLElement>('.mobile-sidebar')
    if (!panel?.animate || instant || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const animation = panel.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], {
      duration: 300, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both',
    })
    navigationAnimation.current = animation
    void animation.finished.then(() => {
      if (navigationAnimation.current === animation) { navigationAnimation.current = null; animation.cancel() }
    }).catch(() => {})
  }

  function closeNavigation(afterClose?: () => void, instant = false) {
    const dialog = navigationDialog.current
    if (!dialog?.open) { afterClose?.(); return }
    const panel = dialog.querySelector<HTMLElement>('.mobile-sidebar')
    const from = panel ? window.getComputedStyle(panel).transform : 'none'
    navigationAnimation.current?.cancel()
    const finish = () => {
      navigationAnimation.current = null
      navigationClosing.current = false
      delete dialog.dataset.closing
      dialog.close()
      afterClose?.()
    }
    if (!panel?.animate || instant || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return }
    navigationClosing.current = true
    dialog.dataset.closing = 'true'
    const animation = panel.animate([{ transform: from }, { transform: 'translateX(-100%)' }], {
      duration: 300, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both',
    })
    navigationAnimation.current = animation
    void animation.finished.then(() => {
      if (navigationAnimation.current === animation) { finish(); animation.cancel() }
    }).catch(() => {})
  }

  function navigate(next: View, recordId?: string) {
    if (navigationClosing.current) return
    setAssistantExplanation(null); setFocusedRecordId(recordId); setView(next)
    const focusTitle = () => { if (!recordId) window.requestAnimationFrame(() => pageTitle.current?.focus()) }
    closeNavigation(focusTitle, document.activeElement?.matches(':focus-visible'))
  }
  const activeNav: { id: View; label: string; icon: IconName }[] = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'work', label: role === 'lead' ? 'Cohort tasks' : 'My work', icon: 'tasks' },
    { id: 'requirements', label: 'Requirements', icon: 'check' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'projects', label: 'Projects', icon: 'flag' },
    { id: 'feedback', label: 'Feedback', icon: 'feedback' },
    { id: 'blockers', label: 'Blockers', icon: 'blocker' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'assistant', label: 'AI assistant', icon: 'spark' },
  ]
  const heading = view === 'overview' ? 'Overview' : view === 'work' ? (role === 'lead' ? 'Cohort tasks' : 'My work') : view === 'requirements' ? 'Requirements' : view === 'assistant' ? 'AI assistant' : view[0].toUpperCase()+view.slice(1)
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

  const descriptions: Record<View, string> = {
    overview: role === 'lead' ? 'Your cohort, moving forward.' : 'A little direction for the work ahead.',
    work: role === 'lead' ? 'Keep team priorities clear and work moving.' : 'Your priorities, deadlines, and progress.',
    requirements: role === 'lead' ? 'Review submissions and guide the next step.' : 'Prepare your work. Share your progress.',
    calendar: 'Make room for what comes next.', projects: 'The work you are building together.',
    feedback: 'Useful perspective for your next step.', blockers: 'Surface obstacles. Find a way forward.',
    notifications: 'Updates from your fellowship.', assistant: 'Think through your next step with Compass.',
  }
  const sidebarContent = (mobile = false) => <>
    <div className="brand"><div className="brand-mark"><CompassMark /></div><div><strong>eif compass</strong><span>Innovation Fellowship</span></div></div>
    {mobile && <button className="nav-close" aria-label="Close navigation" onClick={event => closeNavigation(undefined, event.detail === 0)}><Icon name="close"/></button>}
    <div className="cohort-identity"><span className="cohort-symbol" aria-hidden="true">EIF</span><div><strong>{cohortName}</strong><span>{role === 'lead' ? 'Fellowship lead' : 'Fellow workspace'}</span></div></div>
    <nav className="side-nav" aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
      {activeNav.map((item, index) => <div key={item.id}>{[0,4,7].includes(index) && <div className="side-label">{index===0?'Daily work':index===4?'Fellowship':'Tools'}</div>}<button aria-current={view===item.id?'page':undefined} className={`nav-item ${view===item.id?'selected':''}`} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button></div>)}
    </nav>
    <div className="side-spacer"/>
    <details className="account-menu" onKeyDown={event => {if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}}>
      <summary className="profile-card"><div className="avatar">{initials(displayName)}</div><div className="profile-info"><strong>{displayName}</strong><span>{role==='lead'?'Fellowship lead':'Fellow'}</span></div><Icon name="chevron" size={16}/></summary>
      <div className="account-options"><p>{session.user.email || displayName}</p><button onClick={() => void signOut()}>Sign out</button></div>
    </details>
  </>
  return (
    <div className={`app-shell workspace-${role}`}>
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <aside className="sidebar">{sidebarContent()}</aside>
      <dialog ref={navigationDialog} className="mobile-navigation" aria-label="Workspace navigation" onCancel={event=>{event.preventDefault();closeNavigation(undefined,true)}} onClick={event=>{if(event.target===event.currentTarget)closeNavigation()}}><div className="mobile-sidebar">{sidebarContent(true)}</div></dialog>
      <main className="main-area" id="workspace-content">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={event => openNavigation(event.detail === 0)}><Icon name="menu"/></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{heading}</strong></div>
          <span className="workspace-context">{profile?.team_name || cohortName}</span>
        </header>
        <div className="page-wrap">
          <div className="page-heading">
            <div><h1 ref={pageTitle} tabIndex={-1}>{heading}</h1><p>{descriptions[view]}</p></div>
            {view==='overview' && <button className="text-button refresh-workspace" disabled={loadingData} onClick={() => setRevision(value => value + 1)}>{loadingData?'Refreshing…':'Refresh overview'}</button>}
          </div>
          {supabase && profile?.cohort_id ? view === 'overview' ? <Dashboard client={supabase} role={role} userId={session.user.id} cohortId={profile.cohort_id} revision={revision} onNavigate={navigate} onExplain={action=>{setAssistantExplanation({question:`Explain why “${action.title}” is my next recommended action, using its recorded reason and deadline. Give a practical first step.`,id:action.id,view:action.view,scope:`${session.user.id}:${role}:${profile.cohort_id}`});setView('assistant')}}/> : view === 'assistant' ? <Assistant key={`${session.user.id}:${role}:${profile.cohort_id}`} client={supabase} userId={session.user.id} role={role} cohortId={profile.cohort_id} onNavigate={navigate} initialExplanation={assistantExplanation?.scope===`${session.user.id}:${role}:${profile.cohort_id}`?assistantExplanation:undefined}/> : view==='calendar'?<><div className="manager-actions calendar-action">{role==='lead'&&<button className="text-button" onClick={()=>setShowEventManager(v=>!v)} aria-expanded={showEventManager}>{showEventManager?'Hide event manager':'Manage events'}</button>}<button className="text-button" onClick={()=>setShowSync(v=>!v)} aria-expanded={showSync}>{showSync?'Hide Google sync':'Sync to Google Calendar'}</button></div><Agenda client={supabase} cohortId={profile.cohort_id} revision={revision}/>{showSync&&<GoogleCalendar client={supabase} cohortId={profile.cohort_id}/ >}{role==='lead'&&showEventManager&&<WorkManager focusedRecordId={focusedRecordId} onFocusConsumed={() => setFocusedRecordId(undefined)} key={view} client={supabase} role={role} view={view} userId={session.user.id} cohortId={profile.cohort_id} onChanged={() => setRevision(v => v + 1)}/>}</>:['projects','feedback','blockers','notifications'].includes(view)?<InternFlows onNavigate={navigate} focusedRecordId={focusedRecordId} client={supabase} role={role} view={view} userId={session.user.id} cohortId={profile.cohort_id} onChanged={() => setRevision(v => v + 1)}/>:<WorkManager focusedRecordId={focusedRecordId} onFocusConsumed={() => setFocusedRecordId(undefined)} key={view} client={supabase} role={role} view={view} userId={session.user.id} cohortId={profile.cohort_id} onChanged={() => setRevision(v => v + 1)}/> : <section className="panel" role="alert">Your account has no cohort assigned. Contact your fellowship lead.</section>}

          <footer className="page-footer"><span>EIF COMPASS <span className="footer-sep">·</span> {cohortName}</span><span>Small steps, meaningful progress.</span></footer>
        </div>
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

    </div>
  )
}

function initials(name: string) { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() }

function CompassMark() { return <img src="/compass-mark.svg" width="32" height="32" className="compass-svg" alt="" aria-hidden="true"/> }
