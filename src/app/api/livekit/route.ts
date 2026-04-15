import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room')
  const username = req.nextUrl.searchParams.get('username')

  if (!room || !username) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit credentials not configured' }, { status: 500 })
  }

  const at = new AccessToken(
    apiKey,
    apiSecret,
    { identity: username, name: username }
  )

  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}
