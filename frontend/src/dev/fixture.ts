// Dev-only in-memory stand-in for Supabase, used for visual verification (?fixture=intern|lead).
import type {SupabaseClient} from '@supabase/supabase-js'

type Row = Record<string, any>
type Role = 'intern' | 'lead'

const MS = 86400000
const manila = (ms: number) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms))
const day = (offset: number) => manila(Date.now() + offset * MS)
const at = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString()

const COHORT = 'cohort', TEAM = 'team', PROJECT = 'project', SPRINT = 'sprint', MILESTONE = 'milestone'
const LONG_TITLE = 'DEMO · Reconcile the fellowship resource catalogue across all partner teams now!'
const LONG_NAME = 'Maria Cristina Dela Cruz-Villanueva Jr.'
export const FIXTURE_IDS = {intern: 'a', lead: 'l'}

function seed(): Record<string, Row[]> {
  const scope = {cohort_id: COHORT}
  return {
    cohorts: [{id: COHORT, name: 'Demo rehearsal', starts_on: day(-14), ends_on: day(42)}],
    profiles: [
      {id: 'a', display_name: 'Ana Reyes', role: 'intern', team_name: 'Lagoon', cohort_id: COHORT},
      {id: 'b', display_name: 'Ben Santos', role: 'intern', team_name: 'Lagoon', cohort_id: COHORT},
      {id: 'c', display_name: LONG_NAME, role: 'intern', team_name: 'Lagoon', cohort_id: COHORT},
      {id: 'l', display_name: 'Lia Mercado', role: 'lead', team_name: null, cohort_id: COHORT},
    ],
    teams: [{id: TEAM, name: 'Lagoon', ...scope}],
    team_memberships: ['a', 'b', 'c'].map(user_id => ({team_id: TEAM, user_id, ...scope})),
    projects: [{id: PROJECT, team_id: TEAM, title: 'DEMO · Fellowship Resource Hub', description: 'A shared hub for fellowship resources.', ...scope}],
    sprints: [{id: SPRINT, project_id: PROJECT, title: 'Prototype Sprint', sequence: 1, starts_on: day(-7), ends_on: day(7), ...scope}],
    milestones: [{id: MILESTONE, sprint_id: SPRINT, project_id: PROJECT, title: 'Clickable prototype', due_date: day(5), status: 'in_progress', ...scope}],
    tasks: [
      {id: 't1', title: 'DEMO · Finalize prototype navigation', assignee_id: 'a', status: 'to_do', due_date: day(1), priority: 'high', project_name: 'Fellowship Resource Hub', description: 'Wire every screen into the clickable flow.', project_id: PROJECT, sprint_id: SPRINT, milestone_id: MILESTONE, project_team_id: TEAM, ...scope},
      {id: 't2', title: 'DEMO · Draft onboarding checklist', assignee_id: 'a', status: 'completed', due_date: day(-3), priority: 'medium', project_name: 'Fellowship Resource Hub', project_id: PROJECT, sprint_id: SPRINT, milestone_id: MILESTONE, project_team_id: TEAM, ...scope},
      {id: 't3', title: LONG_TITLE, assignee_id: 'a', status: 'in_progress', due_date: day(3), priority: 'low', project_name: 'Fellowship Resource Hub', project_id: PROJECT, sprint_id: SPRINT, milestone_id: MILESTONE, project_team_id: TEAM, ...scope},
      {id: 't4', title: 'DEMO · Review partner feedback', assignee_id: 'b', status: 'for_review', due_date: day(2), priority: 'medium', project_name: 'Fellowship Resource Hub', project_id: PROJECT, sprint_id: SPRINT, milestone_id: MILESTONE, project_team_id: TEAM, ...scope},
    ],
    requirements: [
      {id: 'r1', title: 'Weekly reflection', description: 'Write a short reflection.', assignee_id: null, status: 'pending', due_date: day(-1), due_at: null, removing: false, ...scope},
      {id: 'r2', title: 'Mentor check-in notes', description: 'Submit notes from your mentor check-in.', assignee_id: null, status: 'pending', due_date: day(1), due_at: at(10), removing: false, ...scope},
      {id: 'r3', title: 'Final presentation outline', description: 'Outline your final presentation.', assignee_id: null, status: 'pending', due_date: day(6), due_at: null, removing: false, ...scope},
      {id: 'r4', title: 'Fellowship agreement', description: 'Sign and upload the agreement.', assignee_id: null, status: 'completed', due_date: day(-5), due_at: null, removing: false, ...scope},
    ],
    requirement_submissions: [{requirement_id: 'r4', user_id: 'a', submission_url: 'https://example.com/agreement', status: 'completed', submitted_at: at(-96), reviewed_at: at(-90)}],
    submission_files: [],
    events: [
      {id: 'e1', title: 'Cohort town hall', starts_at: at(30), event_type: 'Fellowship event', location: 'Main hall', ...scope},
      {id: 'e2', title: 'Sprint demo day', starts_at: at(24 * 5 + 2), event_type: 'Fellowship event', location: 'Online', ...scope},
    ],
    blockers: [{id: 'bl1', reporter_id: 'a', project_id: PROJECT, milestone_id: MILESTONE, category: 'access', description: 'Design asset access', status: 'open', created_at: at(-20), resolved_at: null, ...scope}],
    blocker_comments: [{id: 'bc1', blocker_id: 'bl1', author_id: 'l', body: 'I am requesting access from the design team today.', created_at: at(-10), ...scope}],
    sprint_feedback: [
      {id: 'f1', sprint_id: SPRINT, project_id: PROJECT, author_id: 'l', body: 'Strong progress on navigation. Keep the flow simple.', created_at: at(-30), ...scope},
      {id: 'f2', sprint_id: SPRINT, project_id: PROJECT, author_id: 'l', body: 'Please document open questions before demo day.', created_at: at(-8), ...scope},
    ],
    notifications: ['a', 'l'].flatMap(recipient_id => [
      {id: `n1${recipient_id}`, recipient_id, type: 'task_assigned', title: 'New task: DEMO · Finalize prototype navigation', reference_type: 'task', reference_id: 't1', created_at: at(-5), read_at: null, ...scope},
      {id: `n2${recipient_id}`, recipient_id, type: 'due_soon', title: 'Due soon: Mentor check-in notes', reference_type: 'requirement', reference_id: 'r2', created_at: at(-3), read_at: null, ...scope},
      {id: `n3${recipient_id}`, recipient_id, type: 'feedback', title: 'New feedback on Prototype Sprint', reference_type: 'feedback', reference_id: 'f2', created_at: at(-8), read_at: at(-6), ...scope},
    ]),
  }
}

const ok = (data: unknown) => ({data, error: null})

class Query {
  private filters: ((row: Row) => boolean)[] = []
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: any = null
  private onConflict: string[] = []
  private orderBy: {column: string; ascending: boolean} | null = null
  private max: number | null = null
  private mode: 'one' | 'maybe' | null = null
  private db: Record<string, Row[]>
  private table: string
  constructor(db: Record<string, Row[]>, table: string) { this.db = db; this.table = table }
  select() { return this }
  insert(payload: any) { this.op = 'insert'; this.payload = payload; return this }
  update(payload: any) { this.op = 'update'; this.payload = payload; return this }
  delete() { this.op = 'delete'; return this }
  upsert(payload: any, options?: {onConflict?: string}) { this.op = 'upsert'; this.payload = payload; this.onConflict = (options?.onConflict || 'id').split(','); return this }
  eq(column: string, value: unknown) { this.filters.push(row => row[column] === value); return this }
  neq(column: string, value: unknown) { this.filters.push(row => row[column] !== value); return this }
  in(column: string, values: unknown[]) { this.filters.push(row => values.includes(row[column])); return this }
  is(column: string, value: unknown) { this.filters.push(row => (row[column] ?? null) === value); return this }
  order(column: string, options?: {ascending?: boolean}) { this.orderBy = {column, ascending: options?.ascending !== false}; return this }
  limit(count: number) { this.max = count; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'one'; return this }
  run() {
    const rows = this.db[this.table] ||= []
    const match = (row: Row) => this.filters.every(f => f(row))
    let out: Row[]
    if (this.op === 'insert' || this.op === 'upsert') {
      out = []
      for (const item of [].concat(this.payload)) {
        const existing = this.op === 'upsert' ? rows.find(r => this.onConflict.every(k => r[k] === (item as Row)[k])) : undefined
        if (existing) { Object.assign(existing, item); out.push(existing); continue }
        const row = {id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(item as Row)}
        rows.push(row); out.push(row)
      }
    } else if (this.op === 'update') {
      out = rows.filter(match)
      out.forEach(row => Object.assign(row, this.payload))
    } else if (this.op === 'delete') {
      out = rows.filter(match)
      this.db[this.table] = rows.filter(row => !out.includes(row))
    } else out = rows.filter(match)
    if (this.orderBy) {
      const {column, ascending} = this.orderBy
      out = [...out].sort((x, y) => (x[column] > y[column] ? 1 : x[column] < y[column] ? -1 : 0) * (ascending ? 1 : -1))
    }
    if (this.max !== null) out = out.slice(0, this.max)
    out = out.map(row => ({...row}))
    if (this.mode === 'maybe') return ok(out[0] ?? null)
    if (this.mode === 'one') return out.length === 1 ? ok(out[0]) : {data: null, error: {message: 'JSON object requested, multiple (or no) rows returned'}}
    return ok(out)
  }
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) { return Promise.resolve().then(() => this.run()).then(resolve, reject) }
}

export function createFixtureClient(role: Role): SupabaseClient {
  const db = seed()
  const userId = FIXTURE_IDS[role]
  const session = {access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user: {id: userId, email: `${role}@fixture.test`}}
  let current: typeof session | null = session
  const listeners = new Set<(event: string, session: typeof current) => void>()
  const emit = (event: string) => listeners.forEach(l => l(event, current))
  const client = {
    auth: {
      getSession: async () => ok({session: current}),
      onAuthStateChange(callback: (event: string, session: typeof current) => void) {
        listeners.add(callback)
        queueMicrotask(() => callback('INITIAL_SESSION', current))
        return {data: {subscription: {unsubscribe: () => listeners.delete(callback)}}}
      },
      signInWithPassword: async () => { current = session; emit('SIGNED_IN'); return ok({session, user: session.user}) },
      signOut: async () => { current = null; emit('SIGNED_OUT'); return {error: null} },
    },
    from: (table: string) => new Query(db, table),
    rpc: async () => ok(null),
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ok({signedUrl: `https://fixture.invalid/${path}`}),
        upload: async (path: string) => ok({path}),
        remove: async () => ok([]),
      }),
    },
  }
  return client as unknown as SupabaseClient
}

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {...init, headers: {'Content-Type': 'application/json'}})

function assistantStream(body: Row, signal?: AbortSignal | null) {
  const answer = 'Your nearest deadline is "DEMO · Finalize prototype navigation", due tomorrow. Start there: open the Work page, move the task to In progress, and wire the remaining screens into the clickable flow. Then check Mentor check-in notes, which is due within 24 hours. Your open blocker, Design asset access, already has a lead comment, so follow up there if you are still stuck.'
  const words = answer.split(' '), size = Math.ceil(words.length / 30)
  const chunks = Array.from({length: 30}, (_, i) => words.slice(i * size, (i + 1) * size).join(' ') + ' ').filter(c => c.trim())
  const encoder = new TextEncoder()
  const generatedAt = new Date().toISOString()
  const requestId = body.requestId || crypto.randomUUID()
  const turn = {requestId, sequence: 1, question: String(body.message || ''), answer, generatedAt, truncated: false, sourceRefs: [{id: 't1', view: 'work'}], sources: [{id: 't1', title: 'DEMO · Finalize prototype navigation', view: 'work'}]}
  const result = {...turn, historySaved: true, turn, conversation: {id: 'conv', generation: 1, revision: 1}}
  let timer: ReturnType<typeof setTimeout> | undefined
  return new Response(new ReadableStream({
    start(controller) {
      let i = 0
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      const step = () => {
        if (signal?.aborted) return
        if (i < chunks.length) { send({type: 'delta', text: chunks[i++]}); timer = setTimeout(step, 40) } else { send({type: 'complete', result}); controller.close() }
      }
      signal?.addEventListener('abort', () => { clearTimeout(timer); try { controller.error(new DOMException('Aborted', 'AbortError')) } catch { /* already closed */ } })
      step()
    },
    cancel() { clearTimeout(timer) },
  }), {headers: {'Content-Type': 'application/x-ndjson'}})
}

export function installFixtureFetch(): void {
  const real = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return real(input, init)
    const method = (init?.method || 'GET').toUpperCase()
    if (url.pathname === '/api/assistant/history') {
      const conversation = {id: 'conv', generation: 1, revision: 0}
      if (method === 'GET') return json({conversation, turns: [], has_more: false, next_before: null})
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return json({conversation: {...conversation, revision: (body.revision ?? 0) + 1}, turn: {requestId: body.requestId, question: body.question, answer: body.answer, generatedAt: body.generatedAt, truncated: false, sourceRefs: [], sources: []}})
    }
    if (url.pathname === '/api/assistant') return assistantStream(init?.body ? JSON.parse(String(init.body)) : {}, init?.signal)
    return json({})
  }
}
