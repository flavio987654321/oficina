import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room')
  const username = req.nextUrl.searchParams.get('username')

  if (!room || !username) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: username, name: username }
  )

  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}
