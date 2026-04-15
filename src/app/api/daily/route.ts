import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { roomCode } = await req.json()

  // Crear o reusar sala en Daily con el mismo código de nuestra app
  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomCode,
      properties: {
        max_participants: 8,
        enable_chat: true,
        enable_screenshare: true,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, // expira en 4 horas
      },
    }),
  })

  const data = await response.json()

  // Si la sala ya existe Daily devuelve error, la buscamos
  if (!response.ok) {
    const existing = await fetch(`https://api.daily.co/v1/rooms/${roomCode}`, {
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
    })
    const existingData = await existing.json()
    return NextResponse.json({ url: existingData.url })
  }

  return NextResponse.json({ url: data.url })
}
