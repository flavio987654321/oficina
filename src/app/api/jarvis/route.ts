import { NextRequest, NextResponse } from 'next/server'

import { parseJarvisFallback } from '@/lib/jarvisFallback'
import type { JarvisCommand, JarvisContext } from '@/lib/jarvisTypes'

type JarvisRequestBody = {
  utterance?: string
  context?: JarvisContext
}

type OpenAIResponsePayload = {
  output_text?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  error?: {
    message?: string
  }
}

// ── Schema: comando de UI (acción fija) ──────────────────
const commandSchema = {
  name: 'jarvis_command',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: {
        type: 'string',
        enum: [
          'create_room',
          'join_room',
          'open_panel',
          'close_panel',
          'set_gestures',
          'set_camera',
          'set_microphone',
          'mute_participant',
          'next_page',
          'previous_page',
          'add_note',
          'delete_note',
          'create_project',
          'open_chat',
          'close_chat',
          'unknown',
        ],
      },
      panel: { anyOf: [{ type: 'null' }, { type: 'string', enum: ['pizarra', 'cuaderno', 'notas'] }] },
      state: { anyOf: [{ type: 'null' }, { type: 'string', enum: ['on', 'off', 'toggle'] }] },
      roomName:        { anyOf: [{ type: 'null' }, { type: 'string' }] },
      roomCode:        { anyOf: [{ type: 'null' }, { type: 'string' }] },
      projectName:     { anyOf: [{ type: 'null' }, { type: 'string' }] },
      participantName: { anyOf: [{ type: 'null' }, { type: 'string' }] },
      insertText:      { anyOf: [{ type: 'null' }, { type: 'string' }] },
      reminderAt:      { anyOf: [{ type: 'null' }, { type: 'string' }] },
      spokenReply:     { type: 'string' },
    },
    required: ['action', 'panel', 'state', 'roomName', 'roomCode', 'projectName', 'participantName', 'insertText', 'reminderAt', 'spokenReply'],
  },
  strict: true,
} as const

// ── Schema: respuesta conversacional ────────────────────
const converseSchema = {
  name: 'jarvis_converse',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      spokenReply: { type: 'string' },
      insertText:  { anyOf: [{ type: 'null' }, { type: 'string' }] },
    },
    required: ['spokenReply', 'insertText'],
  },
  strict: true,
} as const

// ── Prompts ──────────────────────────────────────────────
function buildCommandPrompt(utterance: string, context: JarvisContext) {
  return [
    'Sos Jarvis, un asistente de voz en español rioplatense para una app colaborativa llamada Oficina.',
    'Tu trabajo es transformar la frase del usuario en UN comando estructurado.',
    'Solo podés devolver acciones del schema.',
    'Si el usuario nombra "pizarrón" o "pizarrón de notas", eso corresponde al panel "notas".',
    'Si el usuario nombra "pizarra", eso corresponde al panel "pizarra".',
    'Si el usuario nombra "cuaderno" o "proyectos", eso corresponde al panel "cuaderno".',
    'Si el usuario pide pasar de página/hoja, usá next_page o previous_page.',
    'Si el usuario pide prender/apagar algo, usá state on/off.',
    'Si el usuario pide crear un proyecto, usá create_project y poné el nombre en projectName.',
    'Si el usuario pide anotar algo, hacerse acordar de algo, o crear un recordatorio, usá add_note. Esto funciona tanto en dashboard como en sala.',
    'Si el usuario pide silenciar/mutear a otra persona, usá mute_participant y poné el nombre en participantName.',
    'Si el usuario se silencia a sí mismo, usá set_microphone con state off.',
    'Si el usuario quiere volver a la mesa, cerrá el panel.',
    'Si la frase no corresponde a ninguna acción de UI, devolvé action "unknown".',
    'Para add_note: poné el contenido de la nota en insertText (el texto que el usuario quiere anotar).',
    'Para add_note: si el usuario menciona una hora/fecha ("a las 8", "mañana a las 3", "el lunes"), poné reminderAt en ISO 8601 (ej: "2025-01-15T08:00:00"). Usá la fecha de hoy como base. Si no hay fecha/hora, reminderAt es null.',
    'Para cualquier otra acción, insertText es null y reminderAt es null.',
    `Fecha y hora actual: ${new Date().toISOString()}`,
    'spokenReply debe ser breve, natural y en español rioplatense.',
    `Contexto actual: ${JSON.stringify(context)}`,
    `Frase del usuario: ${utterance}`,
  ].join('\n')
}

function buildConversationalPrompt(utterance: string, context: JarvisContext) {
  const panelDesc =
    context.panelContent === 'cuaderno'
      ? `el cuaderno de proyectos (proyecto activo: "${context.currentProjectName ?? 'ninguno'}")`
      : context.panelContent === 'notas'
        ? 'el pizarrón de notas rápidas'
        : context.panelContent === 'pizarra'
          ? 'la pizarra colaborativa'
          : 'la mesa de reunión principal'

  return [
    'Sos Jarvis, el asistente de voz de Oficina, una app de sala de reunión virtual.',
    'Respondé siempre en español rioplatense, de forma natural, cálida y concisa (máx 3 oraciones).',
    'Si el usuario pide que redactes, escribas, generes, o dictés contenido (para el cuaderno o una nota), incluí ese contenido en insertText en texto plano.',
    'Si el usuario solo pregunta algo o charla, dejá insertText null.',
    'Cuando insertText tenga contenido, el spokenReply debe confirmar brevemente que lo vas a insertar.',
    `Contexto: usuario "${context.userName ?? 'desconocido'}", sala "${context.roomName ?? 'desconocida'}", panel abierto: ${panelDesc}.`,
    `Pedido del usuario: ${utterance}`,
  ].join('\n')
}

// ── Helpers ──────────────────────────────────────────────
function extractStructuredText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text
      }
    }
  }
  return null
}

async function callOpenAI(input: string, schema: typeof commandSchema | typeof converseSchema) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_JARVIS_MODEL || 'gpt-4.1-mini'
  if (!apiKey) return null

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input,
      text: { format: { type: 'json_schema', ...schema } },
    }),
  })

  const payload = await response.json() as OpenAIResponsePayload
  if (!response.ok) throw new Error(payload.error?.message || 'OpenAI request failed')

  const raw = extractStructuredText(payload)
  if (!raw) throw new Error('OpenAI response missing structured content')
  return JSON.parse(raw)
}

// ── Handlers ─────────────────────────────────────────────
async function parseWithOpenAI(utterance: string, context: JarvisContext): Promise<JarvisCommand | null> {
  const result = await callOpenAI(buildCommandPrompt(utterance, context), commandSchema)
  return result as JarvisCommand | null
}

async function getConversationalReply(utterance: string, context: JarvisContext): Promise<JarvisCommand | null> {
  const result = await callOpenAI(buildConversationalPrompt(utterance, context), converseSchema) as { spokenReply: string; insertText: string | null } | null
  if (!result) return null

  return {
    action: 'converse',
    panel: null,
    state: null,
    roomName: null,
    roomCode: null,
    projectName: null,
    participantName: null,
    insertText: result.insertText,
    reminderAt: null,
    spokenReply: result.spokenReply,
  }
}

// ── Route handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as JarvisRequestBody
  const utterance = body.utterance?.trim()
  const context = body.context

  if (!utterance || !context) {
    return NextResponse.json({ error: 'Faltan utterance o context' }, { status: 400 })
  }

  // 1. Regex fallback primero — respuesta instantánea para comandos conocidos
  const fallback = parseJarvisFallback(utterance, context)
  if (fallback.action !== 'unknown') {
    return NextResponse.json({ command: fallback, provider: 'fallback' })
  }

  // 2. Regex no lo reconoció → intentar OpenAI para comandos de UI complejos
  let command: JarvisCommand | null = null
  try {
    command = await parseWithOpenAI(utterance, context)
  } catch (error) {
    console.error('Jarvis command parse error:', error)
  }

  if (command && command.action !== 'unknown') {
    return NextResponse.json({ command, provider: 'openai' })
  }

  // 3. Todavía desconocido → modo conversacional (preguntas, redacción libre)
  try {
    const conversational = await getConversationalReply(utterance, context)
    if (conversational) {
      return NextResponse.json({ command: conversational, provider: 'conversational' })
    }
  } catch (error) {
    console.error('Jarvis conversational error:', error)
  }

  return NextResponse.json({ command: fallback, provider: 'fallback' })
}
