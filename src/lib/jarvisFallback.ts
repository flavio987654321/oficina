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

export function parseJarvisFallback(rawUtterance: string, context: JarvisContext): JarvisCommand {
  const utterance = normalize(rawUtterance)
  const panel = detectPanel(utterance)
  const state = detectState(utterance)

  if ((utterance.includes('crear sala') || utterance.includes('creame una sala') || utterance.includes('crea una sala')) && context.route === 'dashboard') {
    const roomName = extractRoomName(rawUtterance) ?? `Sala de ${context.userName ?? 'equipo'}`
    return {
      action: 'create_room',
      panel: null,
      state: null,
      roomName,
      roomCode: null,
      spokenReply: `Listo, voy creando la sala ${roomName}.`,
    }
  }

  if ((utterance.includes('unirme a la sala') || utterance.includes('unirse a la sala') || utterance.includes('entrar a la sala')) && context.route === 'dashboard') {
    const codeMatch = rawUtterance.match(/\b([A-Z0-9]{6})\b/i)
    return {
      action: 'join_room',
      panel: null,
      state: null,
      roomName: null,
      roomCode: codeMatch?.[1]?.toUpperCase() ?? null,
      spokenReply: codeMatch?.[1]
        ? `Voy entrando a la sala ${codeMatch[1].toUpperCase()}.`
        : 'Decime también el código de la sala para entrar.',
    }
  }

  if (panel && /(abr[ií]|abre|abrime|abrirme|mostra|mostrar)/.test(utterance)) {
    const spokenReply = panel === 'pizarra'
      ? 'Abro la pizarra.'
      : panel === 'cuaderno'
        ? 'Abro el cuaderno.'
        : 'Abro el pizarrón de notas.'
    return { action: 'open_panel', panel, state: null, roomName: null, roomCode: null, spokenReply }
  }

  if (/(cerra|cerra|cerrar|oculta|ocultar|salir)/.test(utterance) && context.route === 'room') {
    return {
      action: 'close_panel',
      panel: null,
      state: null,
      roomName: null,
      roomCode: null,
      spokenReply: 'Cierro el panel.',
    }
  }

  if ((utterance.includes('gesto') || utterance.includes('gestos')) && context.route === 'room') {
    return {
      action: 'set_gestures',
      panel: null,
      state,
      roomName: null,
      roomCode: null,
      spokenReply: state === 'off' ? 'Desactivo los gestos.' : state === 'on' ? 'Activo los gestos.' : 'Cambio el estado de los gestos.',
    }
  }

  if (utterance.includes('camara') && context.route === 'room') {
    return {
      action: 'set_camera',
      panel: null,
      state,
      roomName: null,
      roomCode: null,
      spokenReply: state === 'off' ? 'Apago la cámara.' : state === 'on' ? 'Prendo la cámara.' : 'Cambio el estado de la cámara.',
    }
  }

  if ((utterance.includes('microfono') || utterance.includes('micro')) && context.route === 'room') {
    return {
      action: 'set_microphone',
      panel: null,
      state,
      roomName: null,
      roomCode: null,
      spokenReply: state === 'off' ? 'Apago el micrófono.' : state === 'on' ? 'Prendo el micrófono.' : 'Cambio el estado del micrófono.',
    }
  }

  if ((utterance.includes('pagina siguiente') || utterance.includes('hoja siguiente') || utterance.includes('pasar de pagina') || utterance.includes('pasar de hoja') || utterance.includes('siguiente hoja')) && context.route === 'room') {
    return {
      action: 'next_page',
      panel: null,
      state: null,
      roomName: null,
      roomCode: null,
      spokenReply: 'Voy a la hoja siguiente.',
    }
  }

  if ((utterance.includes('pagina anterior') || utterance.includes('hoja anterior') || utterance.includes('volver de pagina') || utterance.includes('anterior hoja')) && context.route === 'room') {
    return {
      action: 'previous_page',
      panel: null,
      state: null,
      roomName: null,
      roomCode: null,
      spokenReply: 'Voy a la hoja anterior.',
    }
  }

  if ((utterance.includes('agrega nota') || utterance.includes('agregar nota') || utterance.includes('crea una nota') || utterance.includes('nueva nota')) && context.route === 'room') {
    return {
      action: 'add_note',
      panel: null,
      state: null,
      roomName: null,
      roomCode: null,
      spokenReply: 'Agrego una nota nueva.',
    }
  }

  if ((utterance.includes('elimina nota') || utterance.includes('borrar nota') || utterance.includes('borra nota')) && context.route === 'room') {
    return {
      action: 'delete_note',
      panel: null,
      state: null,
      roomName: null,
      roomCode: null,
      spokenReply: 'Elimino la nota.',
    }
  }

  if (utterance.includes('chat') && context.route === 'room') {
    return {
      action: /(abr[ií]|abre|mostrar|mostra)/.test(utterance) ? 'open_chat' : 'close_chat',
      panel: null,
      state: null,
      roomName: null,
      roomCode: null,
      spokenReply: /(abr[ií]|abre|mostrar|mostra)/.test(utterance) ? 'Abro el chat.' : 'Cierro el chat.',
    }
  }

  return {
    action: 'unknown',
    panel: null,
    state: null,
    roomName: null,
    roomCode: null,
    spokenReply: 'Todavía no entendí ese pedido. Probá con abrir pizarra, apagar cámara o crear una sala.',
  }
}
