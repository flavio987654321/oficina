// Client-side reminder storage using localStorage

export type StoredReminder = {
  id: string
  text: string
  reminderAt: string // ISO
  createdAt: string
  dismissed: boolean
  roomCode?: string
}

const KEY = 'oficina_reminders'

function load(): StoredReminder[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredReminder[]
  } catch {
    return []
  }
}

function save(reminders: StoredReminder[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(reminders))
}

export function addReminder(text: string, reminderAt: string, roomCode?: string): StoredReminder {
  const reminder: StoredReminder = {
    id: crypto.randomUUID(),
    text,
    reminderAt,
    createdAt: new Date().toISOString(),
    dismissed: false,
    roomCode,
  }
  save([...load(), reminder])
  return reminder
}

export function getDueReminders(): StoredReminder[] {
  const now = new Date().toISOString()
  return load().filter(r => !r.dismissed && r.reminderAt <= now)
}

export function dismissReminder(id: string) {
  save(load().map(r => r.id === id ? { ...r, dismissed: true } : r))
}
