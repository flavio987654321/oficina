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
          'next_page',
          'previous_page',
          'add_note',
          'delete_note',
          'open_chat',
          'close_chat',
          'unknown',
        ],
      },
      panel: {
        anyOf: [
          { type: 'null' },
          { type: 'string', enum: ['pizarra', 'cuaderno', 'notas'] },
        ],
      },
      state: {
        anyOf: [
          { type: 'null' },
          { type: 'string', enum: ['on', 'off', 'toggle'] },
        ],
      },
      roomName: {
        anyOf: [
          { type: 'null' },
          { type: 'string' },
        ],
      },
      roomCode: {
        anyOf: [
          { type: 'null' },
          { type: 'string' },
        ],
      },
      spokenReply: {
        type: 'string',
      },
    },
    required: ['action', 'panel', 'state', 'roomName', 'roomCode', 'spokenReply'],
  },
  strict: true,
} as const

function buildPrompt(utterance: string, context: JarvisContext) {
  return [
    'Sos Jarvis, un asistente de voz en español rioplatense para una app colaborativa llamada Oficina.',
    'Tu trabajo es transformar la frase del usuario en UN comando estructurado.',
    'Solo podés devolver acciones del schema.',
    'Si el usuario nombra "pizarrón" o "pizarrón de notas", eso corresponde al panel "notas".',
    'Si el usuario nombra "pizarra", eso corresponde al panel "pizarra".',
    'Si el usuario nombra "cuaderno" o "proyectos", eso corresponde al panel "cuaderno".',
    'Si el usuario pide pasar de página/hoja, usá next_page o previous_page.',
    'Si el usuario pide prender/apagar algo, usá state on/off.',
    'spokenReply debe ser breve, natural y en español.',
    `Contexto actual: ${JSON.stringify(context)}`,
    `Frase del usuario: ${utterance}`,
  ].join('\n')
}

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

async function parseWithOpenAI(utterance: string, context: JarvisContext) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_JARVIS_MODEL || 'gpt-4.1-mini'

  if (!apiKey) return null

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(utterance, context),
      text: {
        format: {
          type: 'json_schema',
          ...commandSchema,
        },
      },
    }),
  })

  const payload = await response.json() as OpenAIResponsePayload
  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI request failed')
  }

  const raw = extractStructuredText(payload)
  if (!raw) throw new Error('OpenAI response missing structured content')

  return JSON.parse(raw) as JarvisCommand
}

export async function POST(req: NextRequest) {
  const body = await req.json() as JarvisRequestBody
  const utterance = body.utterance?.trim()
  const context = body.context

  if (!utterance || !context) {
    return NextResponse.json({ error: 'Faltan utterance o context' }, { status: 400 })
  }

  try {
    const command = await parseWithOpenAI(utterance, context)
    if (command) {
      return NextResponse.json({ command, provider: 'openai' })
    }
  } catch (error) {
    console.error('Jarvis OpenAI fallback:', error)
  }

  return NextResponse.json({
    command: parseJarvisFallback(utterance, context),
    provider: 'fallback',
  })
}
