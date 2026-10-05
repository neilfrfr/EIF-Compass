export type Role = 'intern' | 'lead'
export type View = 'overview' | 'work' | 'requirements' | 'calendar'

export type Task = {
  id: string
  title: string
  project: string
  due: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'In progress' | 'For review' | 'To do' | 'Completed'
}

export type Requirement = {
  id: string
  title: string
  description: string
  due: string
  status: 'Completed' | 'In review' | 'Pending' | 'Overdue'
}

export type Fellow = {
  name: string
  team: string
  initials: string
  progress: number
  needsAttention: boolean
}

export const demoTasks: Task[] = [
  { id: 't1', title: 'Finalize user interview guide', project: 'Community Insights', due: 'Oct 6', priority: 'High', status: 'In progress' },
  { id: 't2', title: 'Share sprint demo with your team', project: 'Team ritual', due: 'Oct 7', priority: 'Medium', status: 'To do' },
  { id: 't3', title: 'Review onboarding feedback', project: 'Community Insights', due: 'Oct 9', priority: 'Low', status: 'For review' },
]

export const demoRequirements: Requirement[] = [
  { id: 'r1', title: 'Sprint 1 project brief', description: 'Upload the approved project brief and team roles.', due: 'Oct 7', status: 'In review' },
  { id: 'r2', title: 'Learning reflection', description: 'A short reflection on your first two weeks.', due: 'Oct 9', status: 'Pending' },
  { id: 'r3', title: 'Weekly progress update', description: 'Share progress, next steps, and any blockers.', due: 'Oct 10', status: 'Pending' },
  { id: 'r4', title: 'Fellowship welcome form', description: 'Your onboarding details and preferred contact info.', due: 'Oct 2', status: 'Completed' },
]

export const demoFellows: Fellow[] = [
  { name: 'Aika Santos', team: 'Community Insights', initials: 'AS', progress: 82, needsAttention: false },
  { name: 'Miguel Reyes', team: 'Learning Experience', initials: 'MR', progress: 68, needsAttention: false },
  { name: 'Nina Garcia', team: 'Community Insights', initials: 'NG', progress: 45, needsAttention: true },
  { name: 'Paolo Cruz', team: 'Digital Access', initials: 'PC', progress: 74, needsAttention: false },
]

export type EventItem = { day: string; month: string; title: string; meta: string; kind: string }

export const demoEvents: EventItem[] = [
  { day: '07', month: 'OCT', title: 'Sprint 1 check-in', meta: 'Wednesday · 2:00 PM', kind: 'Team milestone' },
  { day: '09', month: 'OCT', title: 'Learning circle: user research', meta: 'Friday · 4:00 PM', kind: 'Fellowship event' },
  { day: '12', month: 'OCT', title: 'Submit weekly progress update', meta: 'Monday · All day', kind: 'Requirement due' },
]
