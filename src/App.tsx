import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { demoEvents, demoFellows, demoRequirements, demoTasks, type EventItem, type Fellow, type Requirement, type Role, type Task, type View } from './data'
import { supabase } from './lib/supabase'

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

function statusClass(status: string) {
  return `status status-${status.toLowerCase().replaceAll(' ', '-')}`
}

function shortDate(value?: string | null) {
  if (!value) return 'No due date'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function App() {
  const [role, setRole] = useState<Role>('intern')
  const [view, setView] = useState<View>('overview')
  const [tasks, setTasks] = useState<Task[]>(demoTasks)
  const [requirements, setRequirements] = useState<Requirement[]>(demoRequirements)
  const [events, setEvents] = useState<EventItem[]>(demoEvents)
  const [fellows] = useState<Fellow[]>(demoFellows)
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<{ display_name?: string; role?: Role; team_name?: string } | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [connected, setConnected] = useState(false)
  const [modal, setModal] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
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
        return
      }
      setLoadingData(true)
      const { data: profileData } = await supabase.from('profiles').select('display_name,role,team_name').eq('id', session.user.id).maybeSingle()
      if (!active) return
      setProfile(profileData)
      setRole(profileData?.role === 'lead' ? 'lead' : 'intern')

      let requirementsQuery = supabase.from('requirements').select('id,title,description,due_date,status,assignee_id').order('due_date')
      if (profileData?.role !== 'lead') requirementsQuery = requirementsQuery.or(`assignee_id.is.null,assignee_id.eq.${session.user.id}`)

      const [taskResult, requirementResult, eventResult] = await Promise.all([
        supabase.from('tasks').select('id,title,project_name,due_date,priority,status,assignee_id').order('due_date'),
        requirementsQuery,
        supabase.from('events').select('id,title,starts_at,event_type').order('starts_at'),
      ])
      if (!active) return
      if (!taskResult.error) {
        setTasks(taskResult.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          project: item.project_name || 'Fellowship work',
          due: shortDate(item.due_date),
          priority: item.priority || 'Medium',
          status: (item.status === 'for_review' ? 'For review' : item.status === 'completed' ? 'Completed' : item.status === 'in_progress' ? 'In progress' : 'To do') as Task['status'],
        })))
      }
      if (!requirementResult.error) {
        setRequirements(requirementResult.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || 'Fellowship requirement',
          due: shortDate(item.due_date),
          status: (item.status === 'in_review' ? 'In review' : item.status === 'completed' ? 'Completed' : item.status === 'overdue' ? 'Overdue' : 'Pending') as Requirement['status'],
        })))
      }
      if (!eventResult.error) {
        setEvents(eventResult.data.map((item: any) => {
          const date = new Date(item.starts_at)
          return {
            day: date.toLocaleDateString('en-US', { day: '2-digit' }),
            month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
            title: item.title,
            meta: `${date.toLocaleDateString('en-US', { weekday: 'long' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
            kind: item.event_type || 'Fellowship event',
          }
        }))
      }
      setConnected(!taskResult.error && !requirementResult.error && !eventResult.error)
      setLoadingData(false)
    }
    void loadWorkspace()
    return () => { active = false }
  }, [session])

  const activeNav: { id: View; label: string; icon: IconName }[] = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'work', label: 'My work', icon: 'tasks' },
    { id: 'requirements', label: 'Requirements', icon: 'check' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  ]
  const heading = view === 'overview' ? 'Overview' : view === 'work' ? 'My work' : view === 'requirements' ? 'Requirements' : 'Calendar'
  const filteredRequirements = useMemo(() => requirements.filter(item => `${item.title} ${item.description} ${item.status}`.toLowerCase().includes(search.toLowerCase())), [requirements, search])
  const dueSoon = requirements.filter(item => item.status !== 'Completed').length
  const completeCount = requirements.filter(item => item.status === 'Completed').length
  const displayName = profile?.display_name || (role === 'lead' ? 'Maya' : 'Aika')

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setAuthError('Add your Supabase URL and anon key to .env.local first.')
      return
    }
    setAuthBusy(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setAuthBusy(false)
    if (error) setAuthError(error.message)
    else setModal(false)
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setConnected(false)
    setTasks(demoTasks)
    setRequirements(demoRequirements)
    setEvents(demoEvents)
    setRole('intern')
  }

  async function completeDemoTask(taskId: string) {
    if (supabase && session?.user?.id) {
      const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId).eq('assignee_id', session.user.id)
      if (error) {
        setToast('Could not update this task. Check the Supabase policy and try again.')
        window.setTimeout(() => setToast(''), 3000)
        return
      }
    }
    setTasks(current => current.map(task => task.id === taskId ? { ...task, status: 'Completed' } : task))
    setToast(session ? 'Nice work — your task is marked complete.' : 'Nice work — your task is marked complete in this demo.')
    window.setTimeout(() => setToast(''), 2600)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><CompassMark /></div><div><strong>eif compass</strong><span>INNOVATION FELLOWSHIP</span></div></div>
        <div className="cohort-switch"><span className="cohort-dot"/><span>2026 Fellowship</span><Icon name="chevron" size={15}/></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {activeNav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'selected' : ''}`} onClick={() => setView(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.id === 'requirements' && <span className="nav-count">{dueSoon}</span>}</button>)}
        </nav>
        <div className="side-spacer"/>
        {session ? <button className="profile-card" onClick={() => void signOut()} title="Sign out"><div className="avatar avatar-lilac">{initials(displayName)}</div><div className="profile-info"><strong>{displayName}</strong><span>{role === 'lead' ? 'Fellowship lead' : 'EIF fellow'}</span></div><Icon name="dots" size={16}/></button> : <div className="demo-card"><div className="demo-icon"><Icon name="spark" size={16}/></div><strong>Demo workspace</strong><p>Explore the experience with sample cohort data.</p><button onClick={() => { setEmail(''); setPassword(''); setAuthError(''); setModal(true) }}>Connect account <Icon name="arrow" size={15}/></button></div>}
        <div className="sidebar-foot"><span className="live-dot"/> Your fellowship, in focus</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>EIF Compass</span><span className="crumb-slash">/</span><strong>{heading}</strong></div>
          <div className="top-actions">
            <label className="search-box"><Icon name="search" size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search requirements" aria-label="Search requirements"/><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast('You’re all caught up on notifications.')}><Icon name="bell"/><i/></button>
            <div className="top-divider"/>
            {session ? <button className="mini-profile" onClick={() => void signOut()}><div className="avatar avatar-lilac">{initials(displayName)}</div><Icon name="chevron" size={14}/></button> : <div className="role-select"><span>Preview as</span><select aria-label="Choose demo role" value={role} onChange={event => setRole(event.target.value as Role)}><option value="intern">Fellow</option><option value="lead">Lead</option></select><Icon name="chevron" size={13}/></div>}
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div><div className="eyebrow">MONDAY, OCTOBER 5, 2026 <span className="eyebrow-line"/></div><h1>{view === 'overview' ? `Good morning, ${displayName.split(' ')[0]}.` : heading}<span className="heading-period">{view === 'overview' ? ' ✦' : ''}</span></h1><p>{role === 'lead' ? 'Here’s how your cohort is moving this week.' : 'A clear view of your fellowship, all in one place.'}</p></div>
            <div className="heading-actions"><div className={`data-pill ${connected ? 'is-connected' : ''}`}><span className="data-dot"/>{connected ? (role === 'lead' ? 'Live records · sample metrics' : 'Supabase connected') : 'Sample cohort data'}</div><button className="primary-button" onClick={() => role === 'lead' ? setView('work') : setView('requirements')}><Icon name={role === 'lead' ? 'tasks' : 'check'} size={16}/>{role === 'lead' ? 'View team tasks' : 'View requirements'}</button></div>
          </div>

          {role === 'intern' ? <InternContent view={view} tasks={tasks} requirements={filteredRequirements} events={events} completeTask={completeDemoTask} completeCount={completeCount} loading={loadingData}/> : <LeadContent view={view} fellows={fellows} requirements={filteredRequirements} tasks={tasks} events={events}/>}

          <footer className="page-footer"><span>EIF COMPASS <span className="footer-sep">·</span> FELLOWSHIP COHORT 2026</span><span>Small steps, meaningful progress.</span></footer>
        </div>
      </main>

      {toast && <div className="toast"><span className="toast-check">✓</span>{toast}</div>}
      {modal && <div className="modal-backdrop" onClick={() => setModal(false)}><section className="auth-modal" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={() => setModal(false)}><Icon name="close"/></button><div className="modal-logo"><CompassMark/></div><span className="eyebrow">WELCOME BACK</span><h2>Sign in to your workspace</h2><p>Use your fellowship account to see your real tasks and requirements.</p><form onSubmit={signIn}><label>Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password"/></label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" size={16}/></button></form><div className="secure-note"><Icon name="lock" size={14}/> Your account is protected by Supabase Auth</div></section></div>}
    </div>
  )
}

function InternContent({ view, tasks, requirements, events, completeTask, completeCount, loading }: { view: View; tasks: Task[]; requirements: Requirement[]; events: EventItem[]; completeTask: (id: string) => void; completeCount: number; loading: boolean }) {
  if (view === 'requirements') return <RequirementsPage requirements={requirements} loading={loading}/>
  if (view === 'work') return <TasksPage tasks={tasks} completeTask={completeTask}/>
  if (view === 'calendar') return <CalendarPage events={events}/>
  return <>
    <section className="hero-grid">
      <article className="progress-card">
        <div className="progress-top"><div><span className="card-kicker">YOUR FELLOWSHIP JOURNEY</span><h2>Week 2 <span>of 8</span></h2></div><div className="week-badge"><span>W</span> 02</div></div>
        <p className="progress-copy">You’re finding your rhythm. Keep showing up and the progress will follow.</p>
        <div className="progress-track"><span style={{ width: '28%' }}/></div>
        <div className="progress-bottom"><span><b>28%</b> fellowship complete</span><span>Next milestone <b>Oct 14</b></span></div>
        <div className="progress-spark"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
      </article>
      <article className="nudge-card"><div className="nudge-icon"><Icon name="spark" size={19}/></div><div className="nudge-label">YOUR NEXT BEST ACTION</div><h3>Finish your interview guide</h3><p>It’s your highest-priority task, and your team needs it before the check-in.</p><div className="nudge-bottom"><span><Icon name="clock" size={14}/> Due Oct 6</span><button onClick={() => window.dispatchEvent(new CustomEvent('open-work-view'))}>View task <Icon name="arrow" size={15}/></button></div><div className="nudge-sticker">Suggested for you <span>✦</span></div></article>
    </section>
    <section className="stats-grid">
      <StatCard label="Tasks in progress" value={String(tasks.filter(task => task.status !== 'Completed').length).padStart(2, '0')} detail="1 due this week" icon="tasks" tone="mint" trend="+2 this week"/>
      <StatCard label="Requirements done" value={`${completeCount}/${requirements.length}`} detail="One more under review" icon="check" tone="peach" trend="On track"/>
      <StatCard label="Upcoming events" value={String(events.length).padStart(2, '0')} detail={events[0] ? `Next: ${events[0].title}` : 'No events scheduled'} icon="calendar" tone="lilac" trend="This week"/>
    </section>
    <div className="content-grid">
      <section className="panel task-panel"><div className="panel-heading"><div><span className="card-kicker">KEEP YOUR MOMENTUM</span><h2>What’s on your plate</h2></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('set-view', { detail: 'work' }))}>See all <Icon name="arrow" size={15}/></button></div><div className="task-list">{tasks.slice(0, 3).map(task => <TaskRow key={task.id} task={task} onComplete={completeTask}/>)}</div><button className="add-task-row" onClick={() => window.dispatchEvent(new CustomEvent('set-view', { detail: 'work' }))}><Icon name="plus" size={16}/> Explore your tasks</button></section>
      <section className="panel requirements-panel"><div className="panel-heading"><div><span className="card-kicker">STAY ON TRACK</span><h2>Requirements</h2></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('set-view', { detail: 'requirements' }))}>View all <Icon name="arrow" size={15}/></button></div><div className="req-progress"><div className="req-ring"><div><b>{completeCount}</b><span>of {requirements.length}</span></div></div><div className="req-progress-copy"><strong>You’re making progress</strong><span>Keep your requirements up to date to stay on track.</span><div className="mini-meter"><span style={{ width: `${requirements.length ? Math.max(20, completeCount / requirements.length * 100) : 0}%` }}/></div></div></div><div className="compact-reqs">{requirements.slice(0, 3).map(item => <div className="compact-req" key={item.id}><span className={`req-check ${item.status === 'Completed' ? 'done' : ''}`}>{item.status === 'Completed' ? '✓' : ''}</span><span>{item.title}</span><span className={statusClass(item.status)}>{item.status}</span></div>)}</div></section>
    </div>
    <section className="panel events-panel"><div className="panel-heading"><div><span className="card-kicker">MARK YOUR CALENDAR</span><h2>Coming up</h2></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('set-view', { detail: 'calendar' }))}>Open calendar <Icon name="arrow" size={15}/></button></div><div className="event-row">{events.map(event => <div className="event-card" key={event.title}><div className="event-date"><strong>{event.day}</strong><span>{event.month}</span></div><div className="event-info"><strong>{event.title}</strong><span><Icon name="clock" size={13}/>{event.meta}</span></div><span className="event-kind">{event.kind}</span></div>)}</div></section>
  </>
}

function LeadContent({ view, fellows, requirements, tasks, events }: { view: View; fellows: Fellow[]; requirements: Requirement[]; tasks: Task[]; events: EventItem[] }) {
  if (view === 'requirements') return <RequirementsPage requirements={requirements} loading={false} lead/>
  if (view === 'calendar') return <CalendarPage events={events}/>
  if (view === 'work') return <section className="panel"><div className="panel-heading"><div><span className="card-kicker">COHORT TASKS</span><h2>Team tasks</h2></div><span className="data-pill">{tasks.length} active</span></div>{tasks.map(task => <TaskRow key={task.id} task={task} onComplete={() => undefined} lead/>)}</section>
  return <>
    <section className="lead-hero"><div><span className="card-kicker">SAMPLE COHORT PULSE</span><h2>A little progress, every day.</h2><p>Your fellows have completed <b>68%</b> of their current sprint commitments. Here’s where a nudge could help.</p><div className="lead-hero-foot"><span className="live-dot"/> Sample data preview <span className="hero-foot-divider"/> 20 fellows <span className="hero-foot-divider"/> 5 teams</div></div><div className="lead-illustration"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-center"><CompassMark/></div><span className="orbit-leaf leaf-a">✦</span><span className="orbit-leaf leaf-b">✧</span><span className="orbit-leaf leaf-c">✦</span></div></section>
    <section className="stats-grid lead-stats"><StatCard label="Active fellows" value="20" detail="Across 5 project teams" icon="users" tone="mint" trend="All active"/><StatCard label="Requirements on time" value="86%" detail="3 due before Friday" icon="check" tone="peach" trend="+8% this sprint"/><StatCard label="Needs a check-in" value="03" detail="Across 2 teams" icon="flag" tone="lilac" trend="View fellows"/></section>
    <div className="content-grid lead-content-grid"><section className="panel fellows-panel"><div className="panel-heading"><div><span className="card-kicker">YOUR PEOPLE</span><h2>Team pulse</h2></div><button className="text-button">View cohort <Icon name="arrow" size={15}/></button></div><div className="fellow-table"><div className="fellow-head"><span>FELLOW</span><span>TEAM</span><span>PROGRESS</span><span>STATUS</span></div>{fellows.map((fellow, index) => <div className="fellow-row" key={fellow.name}><div className="fellow-name"><div className={`avatar avatar-${index}`}>{fellow.initials}</div><strong>{fellow.name}</strong></div><span className="team-name">{fellow.team}</span><div className="fellow-progress"><span><i style={{ width: `${fellow.progress}%` }}/></span><small>{fellow.progress}%</small></div><span className={fellow.needsAttention ? 'attention-pill' : 'steady-pill'}>{fellow.needsAttention ? 'Check in' : 'On track'}</span></div>)}</div></section><section className="panel lead-nudge"><div className="panel-heading"><div><span className="card-kicker">A GENTLE NUDGE</span><h2>Needs your attention</h2></div><span className="attention-count">2</span></div><div className="nudge-person"><div className="avatar avatar-2">NG</div><div><strong>Nina Garcia</strong><span>Community Insights team</span></div><span className="attention-pill">3 days behind</span></div><p>Her Sprint 1 project brief is still pending. A quick check-in may help uncover a blocker.</p><div className="nudge-actions"><button className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent('set-view', { detail: 'requirements' }))}>View progress</button><button className="round-arrow" aria-label="View next action"><Icon name="arrow" size={17}/></button></div><div className="lead-note"><Icon name="spark" size={15}/> Suggested from requirement status · No automated judgment</div></section></div>
    <section className="panel events-panel"><div className="panel-heading"><div><span className="card-kicker">THIS WEEK</span><h2>Upcoming moments</h2></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('set-view', { detail: 'calendar' }))}>Open calendar <Icon name="arrow" size={15}/></button></div><div className="event-row">{events.map(event => <div className="event-card" key={event.title}><div className="event-date"><strong>{event.day}</strong><span>{event.month}</span></div><div className="event-info"><strong>{event.title}</strong><span><Icon name="clock" size={13}/>{event.meta}</span></div><span className="event-kind">{event.kind}</span></div>)}</div></section>
  </>
}

function StatCard({ label, value, detail, icon, tone, trend }: { label: string; value: string; detail: string; icon: IconName; tone: string; trend: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon name={icon} size={17}/></div><span className="stat-label">{label}</span><div className="stat-main"><strong>{value}</strong><span className="stat-trend"><Icon name="trend" size={12}/>{trend}</span></div><span className="stat-detail">{detail}</span></article>
}

function TaskRow({ task, onComplete, lead = false }: { task: Task; onComplete: (id: string) => void; lead?: boolean }) {
  return <div className="task-row"><button className={`task-check ${task.status === 'Completed' ? 'checked' : ''}`} aria-label={`Mark ${task.title} complete`} onClick={() => !lead && onComplete(task.id)}>{task.status === 'Completed' && '✓'}</button><div className="task-copy"><strong>{task.title}</strong><span>{task.project}</span></div><div className="task-meta"><span className={`priority priority-${task.priority.toLowerCase()}`}><i/>{task.priority}</span><span className="due-date"><Icon name="clock" size={13}/>{task.due}</span></div><span className={statusClass(task.status)}>{task.status}</span><button className="row-more" aria-label="More task options"><Icon name="dots" size={16}/></button></div>
}

function RequirementsPage({ requirements, loading, lead = false }: { requirements: Requirement[]; loading: boolean; lead?: boolean }) {
  const [filter, setFilter] = useState('All')
  const statuses = ['All', 'Pending', 'In review', 'Completed', 'Overdue']
  const shown = filter === 'All' ? requirements : requirements.filter(item => item.status === filter)
  return <section className="panel full-page-panel"><div className="panel-heading"><div><span className="card-kicker">{lead ? 'COHORT TRACKING' : 'YOUR FELLOWSHIP CHECKLIST'}</span><h2>{lead ? 'Requirement progress' : 'Your requirements'}</h2></div><span className="data-pill">{requirements.filter(item => item.status === 'Completed').length} of {requirements.length} complete</span></div><p className="section-intro">{lead ? 'Stay close to what’s due and where fellows may need support.' : 'Everything you need to complete during the fellowship, with clear due dates and status.'}</p><div className="filter-tabs">{statuses.map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}{item === 'All' && <span>{requirements.length}</span>}</button>)}</div>{loading && <div className="loading-line">Syncing your workspace…</div>}<div className="requirement-list">{shown.map(item => <article className="requirement-item" key={item.id}><div className={`requirement-symbol ${item.status === 'Completed' ? 'done' : item.status === 'Overdue' ? 'late' : ''}`}>{item.status === 'Completed' ? '✓' : <Icon name="flag" size={17}/>}</div><div className="requirement-detail"><strong>{item.title}</strong><span>{item.description}</span></div><div className="requirement-due"><small>DUE DATE</small><span>{item.due}</span></div><span className={statusClass(item.status)}>{item.status}</span><button className="row-more" aria-label="Requirement details"><Icon name="arrow" size={15}/></button></article>)}{shown.length === 0 && <div className="empty-state">No requirements in this view yet.</div>}</div><div className="requirements-note"><Icon name="spark" size={16}/><span><strong>Need help with a requirement?</strong> Your fellowship lead is here to support you. Add a blocker from your task view.</span></div></section>
}

function TasksPage({ tasks, completeTask }: { tasks: Task[]; completeTask: (id: string) => void }) {
  return <section className="panel full-page-panel"><div className="panel-heading"><div><span className="card-kicker">YOUR SPRINT BOARD</span><h2>Tasks and next steps</h2></div><span className="data-pill">Week 2 · Sprint 1</span></div><p className="section-intro">Small, focused steps help your team make meaningful progress.</p><div className="task-list task-list-page">{tasks.map(task => <TaskRow key={task.id} task={task} onComplete={completeTask}/>)}</div><div className="requirements-note"><Icon name="spark" size={16}/><span><strong>Next best action:</strong> Start with the task due soonest that helps unblock your team.</span></div></section>
}

function CalendarPage({ events }: { events: EventItem[] }) {
  return <section className="panel full-page-panel"><div className="panel-heading"><div><span className="card-kicker">YOUR FELLOWSHIP RHYTHM</span><h2>Coming up this week</h2></div><span className="data-pill">October 2026</span></div><p className="section-intro">A shared view of fellowship events, milestones, and important due dates.</p><div className="calendar-week">{['MON 05', 'TUE 06', 'WED 07', 'THU 08', 'FRI 09', 'SAT 10', 'SUN 11'].map((day, index) => <div className={`calendar-day ${index === 0 ? 'today' : ''}`} key={day}><span>{day.split(' ')[0]}</span><strong>{day.split(' ')[1]}</strong>{index === 0 && <i/>}{index === 4 && <i className="event-dot-alt"/>}</div>)}</div><div className="calendar-events">{events.map(event => <div className="calendar-event" key={event.title}><div className="event-date"><strong>{event.day}</strong><span>{event.month}</span></div><div className="event-info"><span className="event-kind">{event.kind}</span><strong>{event.title}</strong><span><Icon name="clock" size={13}/>{event.meta}</span></div><Icon name="arrow" size={16}/></div>)}</div></section>
}

function initials(name: string) { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() }

function CompassMark() { return <svg viewBox="0 0 40 40" className="compass-svg" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m25.8 14.2-3.6 8-8 3.6 3.6-8 8-3.6Z" fill="currentColor"/><circle cx="20" cy="20" r="1.4" fill="var(--brand-deep)"/><path d="M20 3v4M37 20h-4M20 37v-4M3 20h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
