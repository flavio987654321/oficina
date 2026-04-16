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
  | 'next_page'
  | 'previous_page'
  | 'add_note'
  | 'delete_note'
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
}

export type JarvisCommand = {
  action: JarvisAction
  panel: JarvisPanel | null
  state: JarvisToggleState | null
  roomName: string | null
  roomCode: string | null
  spokenReply: string
}

export function resolveToggleState(current: boolean, state: JarvisToggleState | null) {
  if (state === 'on') return true
  if (state === 'off') return false
  return !current
}
