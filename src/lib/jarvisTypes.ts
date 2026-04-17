export type JarvisRoute = 'dashboard' | 'room'

export type JarvisPanel = 'pizarra' | 'cuaderno' | 'notas'

export type JarvisToggleState = 'on' | 'off' | 'toggle'

export type JarvisAction =
  | 'create_room'
  | 'join_room'
  | 'open_panel'
  | 'close_panel'
  | 'set_gestures'
  | 'set_camera'
  | 'set_microphone'
  | 'mute_participant'
  | 'next_page'
  | 'previous_page'
  | 'add_note'
  | 'delete_note'
  | 'create_project'
  | 'converse'
  | 'open_chat'
  | 'close_chat'
  | 'unknown'

export type JarvisContext = {
  route: JarvisRoute
  userName?: string
  roomName?: string
  roomCode?: string
  roomsCount?: number
  panelContent?: JarvisPanel | null
  gesturesOn?: boolean
  isLeader?: boolean
  /** Nombre del proyecto actualmente abierto en el cuaderno */
  currentProjectName?: string | null
}

export type JarvisCommand = {
  action: JarvisAction
  panel: JarvisPanel | null
  state: JarvisToggleState | null
  roomName: string | null
  roomCode: string | null
  projectName: string | null
  participantName: string | null
  /** Texto que Jarvis quiere insertar en el editor activo (cuaderno o nota) */
  insertText: string | null
  /** ISO timestamp para recordatorios (ej: "2025-06-01T08:00:00") */
  reminderAt: string | null
  spokenReply: string
}

export function resolveToggleState(current: boolean, state: JarvisToggleState | null) {
  if (state === 'on') return true
  if (state === 'off') return false
  return !current
}
