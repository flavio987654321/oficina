'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Message = {
  id: string
  user_name: string
  content: string
  created_at: string
}

const USER_COLORS = [
  { bubble: 'rgba(96,160,208,0.22)', border: 'rgba(96,160,208,0.25)', text: '#c8dff0', name: '#60a0d0' },
  { bubble: 'rgba(80,180,120,0.22)', border: 'rgba(80,180,120,0.25)', text: '#c8f0da', name: '#50b478' },
  { bubble: 'rgba(200,100,200,0.22)', border: 'rgba(200,100,200,0.25)', text: '#f0c8f0', name: '#c864c8' },
  { bubble: 'rgba(220,160,60,0.22)',  border: 'rgba(220,160,60,0.25)',  text: '#f0e0b0', name: '#dca03c' },
  { bubble: 'rgba(220,80,80,0.22)',   border: 'rgba(220,80,80,0.25)',   text: '#f0c8c8', name: '#dc5050' },
  { bubble: 'rgba(80,200,200,0.22)',  border: 'rgba(80,200,200,0.25)',  text: '#c8f0f0', name: '#50c8c8' },
]

function colorForUser(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

function playDing(muted: boolean) {
  if (muted) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
    osc.onended = () => ctx.close()
  } catch {}
}

export default function Chat({
  roomCode, userName, open, onClose, onUnread,
}: {
  roomCode: string
  userName: string
  open: boolean
  onClose: () => void
  onUnread?: (count: number) => void
}) {
  const [messages,   setMessages]   = useState<Message[]>([])
  const [text,       setText]       = useState('')
  const [confirming, setConfirming] = useState(false)
  const [muted,      setMuted]      = useState(false)
  const [unread,     setUnread]     = useState(0)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const openRef     = useRef(open)

  // Keep openRef in sync
  useEffect(() => { openRef.current = open }, [open])

  // Reset unread when chat opens
  useEffect(() => {
    if (open) {
      setUnread(0)
      onUnread?.(0)
    }
  }, [open])

  useEffect(() => {
    supabase.from('messages').select('*')
      .eq('room_code', roomCode)
      .order('created_at', { ascending: true })
      .limit(80)
      .then(({ data }) => { if (data) setMessages(data) })

    const ch = supabase.channel(`chat:${roomCode}`)
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        if (payload.user_name !== userName) {
          setMessages(prev => [...prev, payload as Message])
          if (!openRef.current) {
            playDing(muted)
            setUnread(prev => {
              const next = prev + 1
              onUnread?.(next)
              return next
            })
          }
        }
      })
      .on('broadcast', { event: 'chat-cleared' }, () => {
        setMessages([])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [roomCode, userName])

  // muted changes after mount — update closure via ref
  const mutedRef = useRef(muted)
  useEffect(() => { mutedRef.current = muted }, [muted])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const msg: Message = {
      id: crypto.randomUUID(),
      user_name: userName,
      content,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, msg])
    supabase.channel(`chat:${roomCode}`).send({ type: 'broadcast', event: 'msg', payload: msg })
    supabase.from('messages').insert({ room_code: roomCode, user_name: userName, content })
  }

  async function clearChat() {
    await supabase.from('messages').delete().eq('room_code', roomCode)
    setMessages([])
    setConfirming(false)
    supabase.channel(`chat:${roomCode}`).send({ type: 'broadcast', event: 'chat-cleared', payload: {} })
  }

  if (!open) return null

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 280, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(10,8,4,0.92)',
      backdropFilter: 'blur(12px)',
      borderLeft: '1px solid rgba(255,200,100,0.12)',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid rgba(255,200,100,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <span style={{ color: '#f5e6d0', fontWeight: 700, fontSize: 13, fontFamily: 'sans-serif' }}>
            Chat de la sala
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Mute toggle */}
          <button
            onClick={() => setMuted(m => !m)}
            title={muted ? 'Activar sonido' : 'Silenciar'}
            style={{
              background: muted ? 'rgba(255,255,255,0.06)' : 'rgba(255,200,100,0.08)',
              border: `1px solid ${muted ? 'rgba(255,255,255,0.1)' : 'rgba(255,200,100,0.2)'}`,
              borderRadius: 6, color: muted ? '#4a3a1a' : '#c9935a',
              cursor: 'pointer', fontSize: 13, padding: '3px 6px', lineHeight: 1,
            }}
          >{muted ? '🔕' : '🔔'}</button>

          {/* Clear */}
          <button
            onClick={() => setConfirming(true)}
            title="Limpiar chat"
            style={{
              background: 'rgba(220,60,60,0.12)',
              border: '1px solid rgba(220,60,60,0.2)',
              borderRadius: 6, color: '#e07070',
              cursor: 'pointer', fontSize: 12,
              padding: '3px 8px', fontFamily: 'sans-serif',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 13 }}>🗑</span>
            <span>Limpiar</span>
          </button>

          {/* Close */}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#6b5a3a',
            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '3px 6px',
          }}>✕</button>
        </div>
      </div>

      {/* Confirm clear */}
      {confirming && (
        <div style={{
          padding: '10px 14px', background: 'rgba(180,30,30,0.18)',
          borderBottom: '1px solid rgba(220,60,60,0.2)', flexShrink: 0,
        }}>
          <p style={{ color: '#f0c0c0', fontSize: 12, fontFamily: 'sans-serif', margin: '0 0 8px' }}>
            ¿Borrar todo el historial del chat?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={clearChat} style={{
              flex: 1, background: '#7f1d1d', border: 'none', borderRadius: 6,
              padding: '5px 0', color: '#fecaca', fontSize: 12,
              fontFamily: 'sans-serif', fontWeight: 600, cursor: 'pointer',
            }}>Sí, borrar</button>
            <button onClick={() => setConfirming(false)} style={{
              flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '5px 0', color: '#a08050', fontSize: 12,
              fontFamily: 'sans-serif', cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <p style={{ color: '#6b5a3a', fontSize: 12, textAlign: 'center', marginTop: 40, fontFamily: 'sans-serif', fontStyle: 'italic' }}>
            Nadie habló todavía.<br />¡Empezá la conversación!
          </p>
        )}

        {messages.map((msg, i) => {
          const isMe     = msg.user_name === userName
          const showName = i === 0 || messages[i - 1].user_name !== msg.user_name
          const uc       = isMe ? null : colorForUser(msg.user_name)

          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start',
            }}>
              {showName && (
                <span style={{
                  fontSize: 10, fontFamily: 'sans-serif', marginBottom: 3,
                  marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0,
                  color: isMe ? '#c9935a' : uc!.name,
                  fontWeight: 600,
                }}>
                  {isMe ? 'Vos' : msg.user_name}
                </span>
              )}

              <div style={{
                maxWidth: '82%', padding: '8px 12px',
                borderRadius: isMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                background: isMe ? 'linear-gradient(135deg, #92400e, #6b2d0a)' : uc!.bubble,
                border: isMe ? '1px solid rgba(201,147,90,0.3)' : `1px solid ${uc!.border}`,
                color: isMe ? '#fde68a' : uc!.text,
                fontSize: 13, fontFamily: 'sans-serif', lineHeight: 1.5,
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}>
                {msg.content}
              </div>

              <span style={{
                fontSize: 9, color: '#4a3a1a', marginTop: 2, fontFamily: 'sans-serif',
                marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0,
              }}>
                {formatTime(msg.created_at)}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} style={{
        display: 'flex', gap: 6, padding: '10px',
        borderTop: '1px solid rgba(255,200,100,0.1)', flexShrink: 0,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => {
            setText(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(e as any)
            }
          }}
          placeholder="Escribí un mensaje..."
          rows={1}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,200,100,0.15)', borderRadius: 12,
            padding: '8px 12px', color: '#f0dfc0', fontSize: 13,
            fontFamily: 'sans-serif', outline: 'none',
            resize: 'none', overflow: 'hidden',
            lineHeight: '1.45', minHeight: 36,
          }}
        />
        <button type="submit" style={{
          background: '#92400e', border: 'none', borderRadius: '50%',
          width: 34, height: 34, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginBottom: 1,
        }}>➤</button>
      </form>
    </div>
  )
}
