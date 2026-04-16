'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import JarvisAssistant from '@/components/JarvisAssistant'
import { useJarvisHandler } from '@/lib/jarvisBus'
import { resolveToggleState, type JarvisPanel } from '@/lib/jarvisTypes'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { LiveKitRoom } from '@livekit/components-react'
import '@livekit/components-styles'
import dynamic from 'next/dynamic'

const RoomLayout       = dynamic(() => import('./RoomLayout'),       { ssr: false })
const Chat             = dynamic(() => import('./Chat'),             { ssr: false })
const GestureOverlay   = dynamic(() => import('./GestureOverlay'),   { ssr: false })
const GestureGuide     = dynamic(() => import('./GestureGuide'),     { ssr: false })
const RoomVoiceControls = dynamic(() => import('./RoomVoiceControls'), { ssr: false })

export default function RoomPage() {
  const router = useRouter()
  const { code } = useParams()
  const [roomName,     setRoomName]     = useState('')
  const [userName,     setUserName]     = useState('')
  const [userId,       setUserId]       = useState('')
  const [leaderUserId, setLeaderUserId] = useState('')
  const [token,        setToken]        = useState('')
  const [loading,      setLoading]      = useState(true)
  const [chatOpen,     setChatOpen]     = useState(false)
  const [unread,       setUnread]       = useState(0)
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [closingRoom,  setClosingRoom]  = useState(false)
  const [kicked,       setKicked]       = useState(false)
  const [gestureOn,    setGestureOn]    = useState(false)
  const [guideOpen,    setGuideOpen]    = useState(false)
  const [compactHeader, setCompactHeader] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [panelContent, setPanelContent] = useState<JarvisPanel | null>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null)
  const closePanelRef = useRef<(() => void) | null>(null)

  const isLeader = !!userId && !!leaderUserId && userId === leaderUserId

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { router.push('/auth/login'); return }

      const name = authData.user.user_metadata?.name || authData.user.email || 'Usuario'
      setUserName(name)
      setUserId(authData.user.id)

      const { data: roomData } = await supabase
        .from('rooms').select('name, created_by').eq('code', code).single()

      if (!roomData) { router.push('/dashboard'); return }
      setRoomName(roomData.name)
      setLeaderUserId(roomData.created_by || '')

      const res = await fetch(`/api/livekit?room=${code}&username=${encodeURIComponent(name)}`)
      const { token } = await res.json()
      setToken(token)
      setLoading(false)
    }
    init()
  }, [code, router])

  // Listen for room-closed broadcast
  useEffect(() => {
    if (!code) return
    const ch = supabase.channel(`room-control:${code}`)
      .on('broadcast', { event: 'room-closed' }, () => {
        setKicked(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [code])

  useEffect(() => {
    const updateCompactHeader = () => setCompactHeader(window.innerWidth < 960)
    updateCompactHeader()
    window.addEventListener('resize', updateCompactHeader)
    return () => window.removeEventListener('resize', updateCompactHeader)
  }, [])

  useEffect(() => {
    if (!compactHeader) {
      setMobileMenuOpen(false)
    }
  }, [compactHeader])

  async function handleCloseRoom() {
    // Broadcast to all participants first
    await supabase.channel(`room-control:${code}`).send({
      type: 'broadcast', event: 'room-closed', payload: {},
    })
    // Delete from DB
    await supabase.from('rooms').delete().eq('code', code)
    router.push('/dashboard')
  }

  function handleToggleChat() {
    setChatOpen((open) => !open)
    setUnread(0)
    setMobileMenuOpen(false)
  }

  function handleToggleGestures() {
    setGestureOn((current) => !current)
    setMobileMenuOpen(false)
  }

  function handleOpenGuide() {
    setGuideOpen(true)
    setMobileMenuOpen(false)
  }

  useJarvisHandler(useCallback(async (command) => {
    if (command.action === 'set_gestures') {
      setGestureOn((current) => resolveToggleState(current, command.state))
      return true
    }

    if (command.action === 'open_chat') {
      setChatOpen(true)
      setUnread(0)
      return true
    }

    if (command.action === 'close_chat') {
      setChatOpen(false)
      return true
    }

    return false
  }, []))

  // Kicked screen
  if (kicked) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0a05', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, fontFamily: 'sans-serif',
      }}>
        <span style={{ fontSize: 48 }}>🚪</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f5e6d0' }}>
          La sala fue cerrada
        </h2>
        <p style={{ margin: 0, color: '#7a6040', fontSize: 14 }}>
          El organizador cerró esta sala
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            marginTop: 8, background: '#92400e', border: 'none', borderRadius: 10,
            padding: '10px 28px', color: '#fde68a', fontWeight: 700,
            fontSize: 14, cursor: 'pointer', fontFamily: 'sans-serif',
          }}
        >
          Volver al inicio
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0a05' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: '#a08050', fontFamily: 'sans-serif', fontSize: 14 }}>Conectando a la sala...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#0d0a05', color: 'white', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        background: 'rgba(15,10,3,0.95)', backdropFilter: 'blur(8px)',
        padding: compactHeader ? '0 12px' : '0 20px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,200,100,0.10)',
        flexShrink: 0, position: 'relative', zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              if (panelOpen && closePanelRef.current) closePanelRef.current()
              else router.push('/dashboard')
            }}
            style={{
              background: 'none', border: 'none', color: '#a08050',
              cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            ← {panelOpen ? 'Mesa' : 'Volver'}
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,200,100,0.2)' }} />

          <span style={{ fontWeight: 700, fontSize: 15, color: '#f5e6d0', fontFamily: 'sans-serif' }}>
            {roomName}
          </span>
          <span style={{
            background: 'rgba(255,200,100,0.1)', color: '#c9935a',
            fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
            border: '1px solid rgba(201,147,90,0.3)',
          }}>{code}</span>

          {/* Leader badge */}
          {isLeader && (
            <span style={{
              background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
              fontSize: 10, fontFamily: 'sans-serif', fontWeight: 700,
              padding: '2px 8px', borderRadius: 4,
              border: '1px solid rgba(251,191,36,0.25)',
              letterSpacing: '0.05em',
            }}>ORGANIZADOR</span>
          )}
        </div>

        <div style={{ display: compactHeader ? 'none' : 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#7a6040', fontSize: 12, fontFamily: 'sans-serif' }}>{userName}</span>

          <JarvisAssistant
            context={{
              route: 'room',
              userName,
              roomName,
              roomCode: typeof code === 'string' ? code : '',
              panelContent,
              gesturesOn: gestureOn,
              isLeader,
              currentProjectName,
            }}
          />

          {/* Chat toggle */}
          <button
            onClick={handleToggleChat}
            style={{
              background: chatOpen ? '#92400e' : 'rgba(255,200,100,0.08)',
              border: '1px solid rgba(201,147,90,0.25)',
              borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
              color: chatOpen ? '#fde68a' : '#c9935a',
              fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600,
              display: 'none', alignItems: 'center', gap: 6,
              transition: 'all 0.15s', position: 'relative',
            }}
          >
            💬 Chat
            {unread > 0 && !chatOpen && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: '#ef4444', color: '#fff',
                fontSize: 10, fontWeight: 700, fontFamily: 'sans-serif',
                borderRadius: '50%', minWidth: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', boxShadow: '0 0 0 2px #0d0a05',
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {/* Gesture toggle */}
          <button
            onClick={handleToggleGestures}
            title={gestureOn ? 'Desactivar gestos' : 'Activar gestos con cámara'}
            style={{
              background: gestureOn ? 'rgba(80,200,120,0.12)' : 'rgba(255,200,100,0.08)',
              border: `1px solid ${gestureOn ? 'rgba(80,200,120,0.3)' : 'rgba(201,147,90,0.25)'}`,
              borderRadius: 999, padding: '4px 8px 4px 10px', cursor: 'pointer',
              color: gestureOn ? '#4ade80' : '#c9935a',
              fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            <span>🖐 Gestos</span>
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 18,
                borderRadius: 999,
                background: gestureOn ? '#4ade80' : 'rgba(201,147,90,0.28)',
                position: 'relative',
                boxShadow: gestureOn
                  ? 'inset 0 0 0 1px rgba(40,120,70,0.35)'
                  : 'inset 0 0 0 1px rgba(120,80,35,0.22)',
                transition: 'all 0.18s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: gestureOn ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fffaf0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                  transition: 'left 0.18s ease',
                }}
              />
            </span>
          </button>

          {/* Gesture guide button */}
          <button
            onClick={handleOpenGuide}
            title="Ver guía de gestos"
            style={{
              background: 'rgba(255,200,100,0.08)',
              border: '1px solid rgba(201,147,90,0.25)',
              borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
              color: '#d7a15e', fontSize: 15, fontFamily: 'sans-serif', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >!</button>

          {/* Close room — only leader */}
          {isLeader && (
            <button
              onClick={() => setClosingRoom(true)}
              style={{
                background: 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                color: '#f87171', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              🚪 Cerrar sala
            </button>
          )}
        </div>

        {compactHeader && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            title="Abrir controles de la sala"
            style={{
              background: 'rgba(255,200,100,0.08)',
              border: '1px solid rgba(201,147,90,0.25)',
              borderRadius: 10,
              width: 38,
              height: 38,
              cursor: 'pointer',
              color: '#f5d7a7',
              fontSize: 18,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            =
          </button>
        )}
      </div>

      {compactHeader && mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 55,
            }}
          />

          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(320px, 84vw)',
            background: 'rgba(20,12,4,0.98)',
            borderLeft: '1px solid rgba(255,200,100,0.12)',
            boxShadow: '-20px 0 40px rgba(0,0,0,0.45)',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '18px 16px 14px',
              borderBottom: '1px solid rgba(255,200,100,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#4f46e5,#312e81)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {userName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#f5e6d0', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {userName}
                  </div>
                  <div style={{ color: '#a08050', fontSize: 11, fontFamily: 'monospace' }}>
                    {code}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: 'rgba(255,200,100,0.08)',
                  border: '1px solid rgba(201,147,90,0.22)',
                  borderRadius: 10,
                  width: 34,
                  height: 34,
                  color: '#f5d7a7',
                  fontSize: 18,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                X
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'none' }}>
                <JarvisAssistant
                  context={{
                    route: 'room',
                    userName,
                    roomName,
                    roomCode: typeof code === 'string' ? code : '',
                    panelContent,
                    gesturesOn: gestureOn,
                    isLeader,
                  }}
                />
              </div>

              <button
                onClick={handleToggleChat}
                style={{
                  background: chatOpen ? '#92400e' : 'rgba(255,200,100,0.08)',
                  border: '1px solid rgba(201,147,90,0.25)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  color: chatOpen ? '#fde68a' : '#f5d7a7',
                  fontSize: 13,
                  fontFamily: 'sans-serif',
                  fontWeight: 600,
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>Chat</span>
                {unread > 0 && !chatOpen ? <span>{unread > 99 ? '99+' : unread}</span> : null}
              </button>

              <button
                onClick={handleToggleGestures}
                title={gestureOn ? 'Desactivar gestos' : 'Activar gestos con camara'}
                style={{
                  background: gestureOn ? 'rgba(80,200,120,0.12)' : 'rgba(255,200,100,0.08)',
                  border: `1px solid ${gestureOn ? 'rgba(80,200,120,0.3)' : 'rgba(201,147,90,0.25)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  color: gestureOn ? '#4ade80' : '#f5d7a7',
                  fontSize: 13,
                  fontFamily: 'sans-serif',
                  fontWeight: 600,
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>Gestos</span>
                <span>{gestureOn ? 'Activados' : 'Desactivados'}</span>
              </button>

              <button
                onClick={handleOpenGuide}
                style={{
                  background: 'rgba(255,200,100,0.08)',
                  border: '1px solid rgba(201,147,90,0.25)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  color: '#f5d7a7',
                  fontSize: 13,
                  fontFamily: 'sans-serif',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>Ayuda de gestos</span>
                <span>Ver</span>
              </button>

              {isLeader && (
                <button
                  onClick={() => {
                    setClosingRoom(true)
                    setMobileMenuOpen(false)
                  }}
                  style={{
                    background: 'rgba(220,38,38,0.12)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    color: '#f87171',
                    fontSize: 13,
                    fontFamily: 'sans-serif',
                    fontWeight: 700,
                    textAlign: 'left',
                  }}
                >
                  Cerrar sala
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {compactHeader && (
        <div style={{
          position: 'fixed',
          left: 12,
          right: 88,
          bottom: 16,
          zIndex: 58,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'none',
        }}>
          <div style={{ pointerEvents: 'auto' }}>
            <JarvisAssistant
              context={{
                route: 'room',
                userName,
                roomName,
                roomCode: typeof code === 'string' ? code : '',
                panelContent,
                gesturesOn: gestureOn,
                isLeader,
              }}
            />
          </div>

          <button
            onClick={handleToggleGestures}
            title={gestureOn ? 'Desactivar gestos' : 'Activar gestos con camara'}
            style={{
              pointerEvents: 'auto',
              background: gestureOn ? 'rgba(80,200,120,0.12)' : 'rgba(255,200,100,0.08)',
              border: `1px solid ${gestureOn ? 'rgba(80,200,120,0.3)' : 'rgba(201,147,90,0.25)'}`,
              borderRadius: 999,
              padding: '6px 10px 6px 12px',
              cursor: 'pointer',
              color: gestureOn ? '#4ade80' : '#c9935a',
              fontSize: 12,
              fontFamily: 'sans-serif',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s',
              backgroundColor: gestureOn ? 'rgba(80,200,120,0.12)' : 'rgba(15,10,3,0.92)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
            }}
          >
            <span>Gestos</span>
            <span
              aria-hidden="true"
              style={{
                width: 32,
                height: 18,
                borderRadius: 999,
                background: gestureOn ? '#4ade80' : 'rgba(201,147,90,0.28)',
                position: 'relative',
                boxShadow: gestureOn
                  ? 'inset 0 0 0 1px rgba(40,120,70,0.35)'
                  : 'inset 0 0 0 1px rgba(120,80,35,0.22)',
                transition: 'all 0.18s ease',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: gestureOn ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#fffaf0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                  transition: 'left 0.18s ease',
                }}
              />
            </span>
          </button>
        </div>
      )}

      <button
        onClick={handleToggleChat}
        title={chatOpen ? 'Cerrar chat' : 'Abrir chat'}
        style={{
          position: 'fixed',
          right: 14,
          bottom: 18,
          zIndex: 58,
          width: 58,
          height: 58,
          borderRadius: '50%',
          border: '1px solid rgba(201,147,90,0.28)',
          background: chatOpen ? '#92400e' : 'rgba(15,10,3,0.94)',
          color: chatOpen ? '#fde68a' : '#f5d7a7',
          cursor: 'pointer',
          boxShadow: '0 14px 28px rgba(0,0,0,0.32)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        ...
        {unread > 0 && !chatOpen ? (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            boxShadow: '0 0 0 2px rgba(15,10,3,0.94)',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {/* Confirm close modal */}
      {closingRoom && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1a1208', border: '1px solid rgba(255,200,100,0.15)',
            borderRadius: 16, padding: 32, width: 340,
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            fontFamily: 'sans-serif',
          }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 16 }}>🚪</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f5e6d0', textAlign: 'center' }}>
              ¿Cerrar la sala?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#7a6040', textAlign: 'center', lineHeight: 1.6 }}>
              Todos los participantes serán expulsados y la sala se eliminará permanentemente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setClosingRoom(false)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '10px', color: '#a08050', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif',
                }}
              >Cancelar</button>
              <button
                onClick={handleCloseRoom}
                style={{
                  flex: 1, background: '#7f1d1d',
                  border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10,
                  padding: '10px', color: '#fecaca', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif',
                }}
              >Sí, cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Room + Chat */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <LiveKitRoom
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          connect={!!token}
          video={false}
          audio={false}
          style={{ height: '100%' }}
        >
          <RoomVoiceControls />
          <RoomLayout
            roomCode={code as string}
            userId={userId}
            userName={userName}
            leaderUserId={leaderUserId}
            onPanelOpen={(closeFn) => { setPanelOpen(true);  closePanelRef.current = closeFn }}
            onPanelClose={() =>       { setPanelOpen(false); closePanelRef.current = null  }}
            onPanelChange={(panel) => setPanelContent(panel)}
            onProjectChange={(name) => setCurrentProjectName(name)}
          />
        </LiveKitRoom>

        <Chat
          roomCode={code as string}
          userName={userName}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onUnread={setUnread}
        />
      </div>

      {/* Gesture overlay — only when enabled */}
      {gestureOn && <GestureOverlay />}

      {/* Gesture guide modal */}
      {guideOpen && <GestureGuide onClose={() => setGuideOpen(false)} />}

    </div>
  )
}
