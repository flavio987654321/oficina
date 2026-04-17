import type { JarvisCommand, JarvisContext, JarvisPanel, JarvisToggleState } from './jarvisTypes'

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRoomName(raw: string) {
  const match = raw.match(/(?:sala|room)(?:\s+llamada|\s+que\s+se\s+llame|\s+con\s+nombre)?\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function extractNoteContent(raw: string): string | null {
  const match = raw.match(/(?:anot[aá]me|hac[eé]me acordar\s+(?:de\s+)?|anot[aá]\s+|recod[aá]me\s+(?:de\s+)?)(?:que\s+)?(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function extractReminderDate(text: string): string | null {
  const lower = text.toLowerCase()
  const now = new Date()
  const d = new Date(now)

  const timeMatch = lower.match(/a las (\d{1,2})(?::(\d{2}))?/)
  if (!timeMatch) return null

  const h = parseInt(timeMatch[1])
  const m = parseInt(timeMatch[2] ?? '0')

  if (lower.includes('mañana')) d.setDate(d.getDate() + 1)
  else if (lower.includes('pasado mañana')) d.setDate(d.getDate() + 2)

  d.setHours(h, m, 0, 0)
  if (d <= now && !lower.includes('mañana') && !lower.includes('pasado')) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString()
}

function extractProjectName(raw: string) {
  const match = raw.match(/(?:proyecto|project)(?:\s+llamado|\s+que\s+se\s+llame|\s+con\s+nombre|\s+de)?\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

function extractParticipantName(raw: string) {
  // "silenciá a Juan", "muteá a María García", "apagá el micro de Pedro"
  const matchA  = raw.match(/\b(?:a|al)\s+([A-Za-zÀ-ÿ][\w\s]{1,30}?)(?:\s*$|(?=\s*,|\s*\.))/i)
  const matchDe = raw.match(/\bde\s+([A-Za-zÀ-ÿ][\w\s]{1,30}?)(?:\s*$|(?=\s*,|\s*\.))/i)
  return (matchA?.[1] ?? matchDe?.[1])?.trim() ?? null
}

function detectPanel(text: string): JarvisPanel | null {
  if (text.includes('cuaderno') || text.includes('proyecto')) return 'cuaderno'
  if (text.includes('pizarra')) return 'pizarra'
  if (text.includes('pizarron') || text.includes('pizarron de notas') || text.includes('nota')) return 'notas'
  return null
}

function detectState(text: string): JarvisToggleState | null {
  if (/(prende|encende|enciende|activa|activar|habilita|habilitar)/.test(text)) return 'on'
  if (/(apaga|apagar|desactiva|desactivar|silencia|silenciar|mutea|mutear)/.test(text)) return 'off'
  if (/(toggle|alterna|cambia)/.test(text)) return 'toggle'
  return null
}

// Shorthand to build a full JarvisCommand with all null defaults
function cmd(partial: Partial<JarvisCommand> & Pick<JarvisCommand, 'action' | 'spokenReply'>): JarvisCommand {
  return {
    panel: null,
    state: null,
    roomName: null,
    roomCode: null,
    projectName: null,
    participantName: null,
    insertText: null,
    reminderAt: null,
    ...partial,
  }
}

export function parseJarvisFallback(rawUtterance: string, context: JarvisContext): JarvisCommand {
  const utterance = normalize(rawUtterance)
  const panel = detectPanel(utterance)
  const state = detectState(utterance)

  // ── Dashboard: crear sala ───────────────────────────────
  if ((utterance.includes('crear sala') || utterance.includes('creame una sala') || utterance.includes('crea una sala')) && context.route === 'dashboard') {
    const roomName = extractRoomName(rawUtterance) ?? `Sala de ${context.userName ?? 'equipo'}`
    return cmd({ action: 'create_room', roomName, spokenReply: `Listo, voy creando la sala ${roomName}.` })
  }

  // ── Dashboard: unirse a sala ────────────────────────────
  if ((utterance.includes('unirme a la sala') || utterance.includes('unirse a la sala') || utterance.includes('entrar a la sala')) && context.route === 'dashboard') {
    const codeMatch = rawUtterance.match(/\b([A-Z0-9]{6})\b/i)
    return cmd({
      action: 'join_room',
      roomCode: codeMatch?.[1]?.toUpperCase() ?? null,
      spokenReply: codeMatch?.[1]
        ? `Voy entrando a la sala ${codeMatch[1].toUpperCase()}.`
        : 'Decime también el código de la sala para entrar.',
    })
  }

  // ── Abrir panel ─────────────────────────────────────────
  if (panel && /(abr[ií]|abre|abrime|abrirme|mostra|mostrar)/.test(utterance)) {
    const spokenReply = panel === 'pizarra' ? 'Abro la pizarra.' : panel === 'cuaderno' ? 'Abro el cuaderno.' : 'Abro el pizarrón de notas.'
    return cmd({ action: 'open_panel', panel, spokenReply })
  }

  // ── Cerrar panel / volver a la mesa ─────────────────────
  if (/(cerra|cerrar|oculta|ocultar|salir|volver|volve|volvete|regresa|regrese|ir a la mesa|la mesa|volver a mesa)/.test(utterance) && context.route === 'room') {
    return cmd({ action: 'close_panel', spokenReply: 'Vuelvo a la mesa.' })
  }

  // ── Gestos ──────────────────────────────────────────────
  if ((utterance.includes('gesto') || utterance.includes('gestos')) && context.route === 'room') {
    return cmd({
      action: 'set_gestures',
      state,
      spokenReply: state === 'off' ? 'Desactivo los gestos.' : state === 'on' ? 'Activo los gestos.' : 'Cambio el estado de los gestos.',
    })
  }

  // ── Silenciar a OTRO participante (detectar " a " = target externo) ──
  if (/(silencia|mutea|apaga|desactiva)/.test(utterance) && utterance.includes(' a ') && context.route === 'room') {
    const participantName = extractParticipantName(rawUtterance)
    return cmd({
      action: 'mute_participant',
      state: 'off',
      participantName,
      spokenReply: participantName
        ? `Silencio a ${participantName} en tu dispositivo.`
        : '¿A quién querés silenciar? Decime el nombre.',
    })
  }

  // ── Cámara propia ───────────────────────────────────────
  if ((utterance.includes('camara') || utterance.includes('video') || utterance.includes('cam ') || utterance.endsWith('cam')) && context.route === 'room') {
    const camState = state ?? (/(apaga|apagar|desactiva|saca|quita|cierra)/.test(utterance) ? 'off' : /(prende|prender|activa|activar|muestra|mostrar|pone|poner)/.test(utterance) ? 'on' : null)
    return cmd({
      action: 'set_camera',
      state: camState,
      spokenReply: camState === 'off' ? 'Apago la cámara.' : camState === 'on' ? 'Prendo la cámara.' : 'Cambio el estado de la cámara.',
    })
  }

  // ── Micrófono propio — "silenciame", "muteame", "apagá el micro", "activame el audio" ──
  const isMicPhrase =
    utterance.includes('microfono') ||
    utterance.includes('micro') ||
    utterance.includes('audio') ||
    /silencia(me)?$|muteame|mutearme/.test(utterance) ||
    (/(silencia|mutea)/.test(utterance) && !utterance.includes(' a '))
  if (isMicPhrase && context.route === 'room') {
    const micState = state ?? (/(apaga|silencia|mutea|desactiva|corta)/.test(utterance) ? 'off' : /(activa|prende|prender|activar|abre)/.test(utterance) ? 'on' : null)
    return cmd({
      action: 'set_microphone',
      state: micState,
      spokenReply: micState === 'off' ? 'Te silencio.' : micState === 'on' ? 'Activo el micrófono.' : 'Cambio el estado del micrófono.',
    })
  }

  // ── Página siguiente / anterior ─────────────────────────
  if ((utterance.includes('pagina siguiente') || utterance.includes('hoja siguiente') || utterance.includes('pasar de pagina') || utterance.includes('pasar de hoja') || utterance.includes('siguiente hoja')) && context.route === 'room') {
    return cmd({ action: 'next_page', spokenReply: 'Voy a la hoja siguiente.' })
  }

  if ((utterance.includes('pagina anterior') || utterance.includes('hoja anterior') || utterance.includes('volver de pagina') || utterance.includes('anterior hoja')) && context.route === 'room') {
    return cmd({ action: 'previous_page', spokenReply: 'Voy a la hoja anterior.' })
  }

  // ── Notas rápidas / recordatorios ──────────────────────
  const isNoteRequest =
    utterance.includes('agrega nota') || utterance.includes('agregar nota') ||
    utterance.includes('crea una nota') || utterance.includes('nueva nota') ||
    /anot[aá]me/.test(utterance) || /hac[eé]me acordar/.test(utterance) ||
    /recod[aá]me/.test(utterance)
  if (isNoteRequest) {
    const insertText = extractNoteContent(rawUtterance) ?? null
    const reminderAt = extractReminderDate(rawUtterance)
    const replyText = reminderAt
      ? `Anoto y te aviso cuando llegue el momento.`
      : insertText
        ? `Anoto: "${insertText.slice(0, 40)}${insertText.length > 40 ? '…' : ''}".`
        : 'Agrego una nota nueva.'
    return cmd({ action: 'add_note', insertText, reminderAt, spokenReply: replyText })
  }

  if ((utterance.includes('elimina nota') || utterance.includes('borrar nota') || utterance.includes('borra nota')) && context.route === 'room') {
    return cmd({ action: 'delete_note', spokenReply: 'Elimino la nota.' })
  }

  // ── Crear proyecto ──────────────────────────────────────
  if ((utterance.includes('crea un proyecto') || utterance.includes('creame un proyecto') || utterance.includes('crear proyecto') || utterance.includes('nuevo proyecto')) && context.route === 'room') {
    const projectName = extractProjectName(rawUtterance) ?? 'Proyecto nuevo'
    return cmd({ action: 'create_project', projectName, spokenReply: `Listo, creo el proyecto ${projectName}.` })
  }

  // ── Chat ────────────────────────────────────────────────
  if (utterance.includes('chat') && context.route === 'room') {
    const open = /(abr[ií]|abre|mostrar|mostra)/.test(utterance)
    return cmd({ action: open ? 'open_chat' : 'close_chat', spokenReply: open ? 'Abro el chat.' : 'Cierro el chat.' })
  }

  return cmd({
    action: 'unknown',
    spokenReply: 'Todavía no entendí ese pedido. Probá con abrir pizarra, apagar cámara o crear una sala.',
  })
}
