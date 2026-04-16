'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import JarvisAssistant from '@/components/JarvisAssistant'
import { useJarvisHandler } from '@/lib/jarvisBus'
import { supabase } from '@/lib/supabase'

type Room = { id: string; name: string; code: string; created_at: string }

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'crear' | 'unirse'>('crear')

  const loadRooms = useCallback(async (uid: string) => {
    const { data } = await supabase.from('rooms').select('*')
      .eq('created_by', uid)
      .order('created_at', { ascending: false })
    if (data) setRooms(data)
  }, [])

  const createRoom = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false

    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('rooms').insert({ name: trimmed, code: generateCode(), created_by: userId })
      .select().single()
    setLoading(false)

    if (error) setError('Error al crear la sala')
    else {
      setNewRoomName('')
      router.push(`/room/${data.code}`)
    }

    return !error
  }, [router, userId])

  const joinRoom = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return false

    setError('')
    const { data } = await supabase.from('rooms').select('*')
      .eq('code', trimmed).single()

    if (!data) setError('Código de sala inválido')
    else router.push(`/room/${data.code}`)

    return !!data
  }, [router])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUserName(data.user.user_metadata?.name || data.user.email || '')
      setUserId(data.user.id)
      void loadRooms(data.user.id)
    })
  }, [loadRooms, router])

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault()
    await createRoom(newRoomName)
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault()
    await joinRoom(joinCode)
  }

  const initials = userName ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'
  const firstName = userName.split(' ')[0]

  useJarvisHandler(useCallback(async (command) => {
    if (command.action === 'create_room') {
      return createRoom(command.roomName || `Sala de ${firstName || 'equipo'}`)
    }

    if (command.action === 'join_room' && command.roomCode) {
      return joinRoom(command.roomCode)
    }

    return false
  }, [createRoom, firstName, joinRoom]))

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f4f5',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        .dashboard-header {
          min-height: 60px;
          background: #fff;
          border-bottom: 1px solid #e4e4e7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 50;
          gap: 16px;
        }
        .dashboard-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .dashboard-user-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .dashboard-account-stack {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .dashboard-main {
          max-width: 960px;
          margin: 0 auto;
          padding: 48px 24px;
        }
        .dashboard-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 40px;
        }
        .dashboard-room-form {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }
        .dashboard-rooms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        @media (max-width: 820px) {
          .dashboard-header {
            padding: 12px 16px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: start;
            row-gap: 10px;
          }
          .dashboard-header-right {
            display: contents;
          }
          .dashboard-user-actions {
            grid-column: 1 / 2;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
          }
          .dashboard-main {
            padding: 28px 16px 40px;
          }
          .dashboard-room-form {
            flex-direction: column;
            align-items: stretch;
          }
          .dashboard-room-form button[type="submit"] {
            width: 100%;
          }
          .dashboard-rooms-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .dashboard-brand {
            align-self: center;
          }
          .dashboard-user-actions {
            align-items: center;
          }
          .dashboard-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }
          .dashboard-stat-card {
            padding: 16px 12px !important;
          }
          .dashboard-stat-value {
            font-size: 18px !important;
            line-height: 1.1;
            word-break: break-word;
          }
          .dashboard-stat-label {
            font-size: 11px !important;
          }
          .dashboard-greeting {
            font-size: 24px !important;
            line-height: 1.15;
          }
          .dashboard-panel {
            padding: 24px 16px !important;
          }
          .dashboard-tab-group {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }
          .dashboard-tab-group button {
            width: 100%;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
          .dashboard-user-chip {
            min-width: 0;
            max-width: calc(100vw - 170px);
          }
          .dashboard-user-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .dashboard-account-stack {
            justify-self: end;
            align-self: start;
            gap: 6px;
            flex-direction: column;
            align-items: flex-end;
          }
          .dashboard-user-chip {
            justify-content: flex-end;
          }
          .dashboard-signout {
            padding: 6px 10px !important;
            font-size: 12px !important;
          }
          .dashboard-room-card {
            padding: 20px !important;
          }
          .dashboard-empty-state {
            padding: 40px 20px !important;
          }
        }
      `}</style>

      <header className="dashboard-header">
        <div className="dashboard-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #1c1917, #44403c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fbbf24', fontWeight: 800, fontSize: 15,
          }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#18181b', letterSpacing: '-0.3px' }}>
            Oficina
          </span>
        </div>

        <div className="dashboard-header-right">
          <div className="dashboard-account-stack">
            <div className="dashboard-user-chip" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1c1917, #44403c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fbbf24', fontWeight: 700, fontSize: 12,
                flexShrink: 0,
              }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <p className="dashboard-user-name" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#18181b', lineHeight: 1.2 }}>{userName}</p>
              </div>
            </div>

            <button
              className="dashboard-signout"
              onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login') }}
              style={{
                background: 'none', border: '1px solid #e4e4e7', borderRadius: 8,
                padding: '6px 14px', cursor: 'pointer', color: '#71717a',
                fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
              }}
            >Cerrar sesión</button>
          </div>

          <div className="dashboard-user-actions">
            <JarvisAssistant
              variant="light"
              context={{
                route: 'dashboard',
                userName,
                roomsCount: rooms.length,
              }}
            />
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div style={{ marginBottom: 40 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#a1a1aa', fontWeight: 500 }}>
            Bienvenido de vuelta
          </p>
          <h1 className="dashboard-greeting" style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#18181b', letterSpacing: '-0.5px' }}>
            Hola, {firstName} 👋
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#71717a' }}>
            {rooms.length > 0
              ? `Tenés ${rooms.length} sala${rooms.length !== 1 ? 's' : ''} disponible${rooms.length !== 1 ? 's' : ''}`
              : 'Creá tu primera sala y compartí el código'}
          </p>
        </div>

        <div className="dashboard-stats">
          {[
            { label: 'Salas activas', value: rooms.length, icon: '🏢' },
            { label: 'Última actividad', value: rooms[0] ? new Date(rooms[0].created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—', icon: '📅' },
            { label: 'Estado', value: 'En línea', icon: '🟢' },
          ].map(stat => (
            <div key={stat.label} className="dashboard-stat-card" style={{
              background: '#fff', borderRadius: 12, padding: '20px 22px',
              border: '1px solid #e4e4e7',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 20 }}>{stat.icon}</p>
              <p className="dashboard-stat-value" style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: '#18181b' }}>{stat.value}</p>
              <p className="dashboard-stat-label" style={{ margin: 0, fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="dashboard-panel" style={{
          background: '#fff', borderRadius: 16, padding: 32,
          border: '1px solid #e4e4e7',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          marginBottom: 40,
        }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 700, color: '#18181b' }}>
            Crear o unirse a una sala
          </h2>

          <div className="dashboard-tab-group" style={{
            display: 'inline-flex', background: '#f4f4f5', borderRadius: 10,
            padding: 4, gap: 2, marginBottom: 28,
          }}>
            {(['crear', 'unirse'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '7px 20px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#18181b' : '#71717a',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
                {t === 'crear' ? '+ Crear sala' : '→ Unirse'}
              </button>
            ))}
          </div>

          {tab === 'crear' ? (
            <form onSubmit={handleCreateRoom} className="dashboard-room-form">
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 600,
                  color: '#52525b', marginBottom: 8, letterSpacing: '0.02em',
                }}>
                  Nombre de la sala
                </label>
                <input
                  type="text" value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="Ej: Reunión de equipo, Proyecto Kairos..."
                  style={{
                    width: '100%', background: '#fafafa',
                    border: '1px solid #e4e4e7', borderRadius: 10,
                    padding: '11px 14px', color: '#18181b', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#71717a')}
                  onBlur={e => (e.target.style.borderColor = '#e4e4e7')}
                />
              </div>
              <button type="submit" disabled={loading} style={{
                background: '#18181b', border: 'none', borderRadius: 10,
                padding: '11px 24px', color: '#fff', fontWeight: 600,
                fontSize: 14, cursor: 'pointer', flexShrink: 0,
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              }}>
                {loading ? 'Creando...' : 'Crear y entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinRoom} className="dashboard-room-form">
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 600,
                  color: '#52525b', marginBottom: 8, letterSpacing: '0.02em',
                }}>
                  Código de sala
                </label>
                <input
                  type="text" value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="AB3X7K"
                  maxLength={6}
                  style={{
                    width: '100%', background: '#fafafa',
                    border: '1px solid #e4e4e7', borderRadius: 10,
                    padding: '11px 14px', color: '#18181b', fontSize: 20,
                    letterSpacing: 8, fontFamily: 'monospace', outline: 'none',
                    boxSizing: 'border-box', textTransform: 'uppercase',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#71717a')}
                  onBlur={e => (e.target.style.borderColor = '#e4e4e7')}
                />
              </div>
              <button type="submit" style={{
                background: '#18181b', border: 'none', borderRadius: 10,
                padding: '11px 24px', color: '#fff', fontWeight: 600,
                fontSize: 14, cursor: 'pointer', flexShrink: 0,
              }}>
                Entrar
              </button>
            </form>
          )}

          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12, fontWeight: 500 }}>{error}</p>
          )}
        </div>

        {rooms.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181b' }}>
                Mis salas
              </h2>
              <span style={{ fontSize: 12, color: '#a1a1aa', flexShrink: 0 }}>{rooms.length} sala{rooms.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="dashboard-rooms-grid">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="dashboard-room-card"
                  onClick={() => router.push(`/room/${room.code}`)}
                  style={{
                    background: '#fff', borderRadius: 14, padding: 24,
                    border: '1px solid #e4e4e7',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(-2px)'
                    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
                    el.style.borderColor = '#d4d4d8'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'
                    el.style.borderColor = '#e4e4e7'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: '#f4f4f5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, border: '1px solid #e4e4e7',
                      flexShrink: 0,
                    }}>🏢</div>
                    <span style={{
                      background: '#f4f4f5', color: '#71717a',
                      fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                      padding: '4px 8px', borderRadius: 6, border: '1px solid #e4e4e7',
                      letterSpacing: 1, flexShrink: 0,
                    }}>{room.code}</span>
                  </div>

                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: '#18181b', wordBreak: 'break-word' }}>
                    {room.name}
                  </p>
                  <p style={{ margin: '0 0 20px', color: '#a1a1aa', fontSize: 12 }}>
                    Creada el {new Date(room.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: 16, borderTop: '1px solid #f4f4f5', gap: 12,
                  }}>
                    <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>
                      Sala de trabajo
                    </span>
                    <span style={{ fontSize: 13, color: '#18181b', fontWeight: 600, flexShrink: 0 }}>
                      Entrar →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {rooms.length === 0 && (
          <div className="dashboard-empty-state" style={{
            background: '#fff', borderRadius: 16, padding: '60px 32px',
            border: '1px solid #e4e4e7', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🏢</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#18181b', margin: '0 0 6px' }}>
              No hay salas todavía
            </p>
            <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>
              Creá tu primera sala de trabajo arriba
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
