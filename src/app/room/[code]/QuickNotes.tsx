'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGesture } from '@/lib/useGesture'
import { useJarvisHandler } from '@/lib/jarvisBus'

type StickyNote = {
  id: string
  title: string
  text: string
  color: string
  createdAt: string
}

const COLORS = [
  { bg: '#fef08a', border: '#facc15', name: 'Amarillo' },
  { bg: '#bbf7d0', border: '#4ade80', name: 'Verde'    },
  { bg: '#bfdbfe', border: '#60a5fa', name: 'Azul'     },
  { bg: '#fecaca', border: '#f87171', name: 'Rojo'     },
  { bg: '#e9d5ff', border: '#c084fc', name: 'Violeta'  },
]

function getColor(colorBg: string) {
  return COLORS.find(c => c.bg === colorBg) ?? COLORS[0]
}

// ── Thumbtack SVG ──
function Tack({ color = '#e53e3e' }: { color?: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" style={{ display: 'block' }}>
      <circle cx="9" cy="8" r="7" fill={color}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
      <circle cx="7" cy="6" r="2" fill="rgba(255,255,255,0.35)" />
      <line x1="9" y1="15" x2="9" y2="22" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Single sticky note on board ──
function NoteCard({ note, index, onClick, hovered, grabbed }: {
  note: StickyNote; index: number; onClick: () => void
  hovered?: boolean; grabbed?: boolean
}) {
  const rot = ((index * 13) % 14) - 7
  const color = getColor(note.color)
  const preview = note.text.slice(0, 120) + (note.text.length > 120 ? '…' : '')

  const transform = grabbed
    ? `rotate(${rot * 0.2}deg) scale(1.08) translateY(-6px)`
    : hovered
      ? `rotate(${rot * 0.3}deg) scale(1.05) translateY(-4px)`
      : `rotate(${rot}deg)`

  return (
    <div
      onClick={onClick}
      data-note-id={note.id}
      style={{
        position: 'relative',
        background: color.bg,
        borderBottom: `3px solid ${color.border}`,
        borderRadius: 2,
        padding: '28px 14px 14px',
        transform,
        cursor: 'pointer',
        boxShadow: grabbed
          ? `0 16px 40px rgba(0,0,0,0.45), 0 0 0 3px ${color.border}`
          : hovered
            ? '4px 8px 20px rgba(0,0,0,0.3)'
            : '2px 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        minHeight: 140,
        userSelect: 'none',
        opacity: grabbed ? 0.7 : 1,
        zIndex: grabbed ? 10 : hovered ? 5 : 1,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = `rotate(${rot * 0.3}deg) scale(1.05) translateY(-4px)`
        ;(e.currentTarget as HTMLElement).style.boxShadow = '4px 8px 20px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = `rotate(${rot}deg)`
        ;(e.currentTarget as HTMLElement).style.boxShadow = '2px 4px 12px rgba(0,0,0,0.25)'
      }}
    >
      {/* Tack */}
      <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
        <Tack color={index % 3 === 0 ? '#e53e3e' : index % 3 === 1 ? '#3182ce' : '#38a169'} />
      </div>

      {/* Title */}
      {note.title && (
        <p style={{
          fontWeight: 700, fontSize: 13, color: '#1a1208',
          fontFamily: 'sans-serif', marginBottom: 6,
          borderBottom: `1px solid ${color.border}`, paddingBottom: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{note.title}</p>
      )}

      {/* Text preview */}
      <p style={{
        fontSize: 12, color: '#3a2a10', fontFamily: 'Georgia, serif',
        lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>{preview || <span style={{ color: '#a08050', fontStyle: 'italic' }}>Nota vacía...</span>}</p>

      {/* Date bottom-right */}
      <p style={{
        position: 'absolute', bottom: 7, right: 10,
        fontSize: 10, color: '#7a5a20', fontFamily: 'sans-serif',
        fontStyle: 'italic', borderTop: `1px solid ${color.border}`,
        paddingTop: 3, marginLeft: 8,
      }}>
        📅 {new Date(note.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
      </p>
    </div>
  )
}

// ── Edit modal ──
function NoteModal({ note, onSave, onDelete, onClose }: {
  note: StickyNote
  onSave: (n: StickyNote) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [text,  setText]  = useState(note.text)
  const [color, setColor] = useState(note.color)
  const color_ = getColor(color)

  function save() { onSave({ ...note, title, text, color }) }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) { save(); onClose() } }}>

      <div style={{
        background: '#fffef5',
        width: 420, borderRadius: 3,
        boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Tack */}
        <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
          <Tack />
        </div>

        {/* Colored top strip */}
        <div style={{ height: 12, background: color_.bg, borderBottom: `3px solid ${color_.border}` }} />

        {/* Color picker */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px 8px', alignItems: 'center' }}>
          {COLORS.map(c => (
            <button key={c.bg} onClick={() => setColor(c.bg)} title={c.name} style={{
              width: 20, height: 20, borderRadius: '50%', background: c.bg,
              border: color === c.bg ? `2px solid #333` : `2px solid ${c.border}`,
              cursor: 'pointer', transition: 'transform 0.1s',
              transform: color === c.bg ? 'scale(1.25)' : 'scale(1)',
            }} />
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => { save(); onClose() }} title="Cerrar" style={{
            background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: '50%',
            width: 26, height: 26, cursor: 'pointer', fontSize: 14, color: '#555',
          }}>✕</button>
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título..."
          style={{
            background: 'transparent', border: 'none',
            borderBottom: '1px solid #e0d8c8',
            padding: '8px 16px 10px', fontSize: 16, fontWeight: 700,
            fontFamily: 'sans-serif', color: '#1a1208', outline: 'none',
          }}
        />

        {/* Text — lined paper */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribí tu nota..."
          autoFocus
          style={{
            background: `repeating-linear-gradient(
              #fffef5 0px, #fffef5 27px,
              #dde8f0 27px, #dde8f0 28px
            )`,
            border: 'none', resize: 'none', outline: 'none',
            padding: '6px 16px', fontSize: 14, lineHeight: '28px',
            fontFamily: 'Georgia, serif', color: '#1a1208',
            minHeight: 220,
          }}
        />

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', borderTop: '1px solid #e8e0d0',
          background: '#faf6ef',
        }}>
          <button onClick={onDelete} style={{
            background: 'rgba(220,50,50,0.15)', border: 'none', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer', fontSize: 12,
            color: '#c0392b', fontFamily: 'sans-serif',
          }}>🗑 Eliminar</button>
          <button onClick={() => { save(); onClose() }} style={{
            background: '#2d6a4f', border: 'none', borderRadius: 6,
            padding: '6px 16px', cursor: 'pointer', fontSize: 13,
            color: '#fff', fontFamily: 'sans-serif', fontWeight: 600,
          }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──
export default function QuickNotes({ roomCode, userName }: { roomCode: string; userName: string }) {
  const [notes,        setNotes]        = useState<StickyNote[]>([])
  const [editing,      setEditing]      = useState<StickyNote | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [grabbedNote,  setGrabbedNote]  = useState<StickyNote | null>(null)
  const [ghostPos,     setGhostPos]     = useState({ x: 0, y: 0 })
  const [overTrash,    setOverTrash]    = useState(false)
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRemote   = useRef(false)
  const trashRef   = useRef<HTMLDivElement>(null)
  const notesRef   = useRef<Map<string, HTMLDivElement>>(new Map())

  // ── Gesture integration ──
  useGesture(useCallback((e) => {
    const px = e.x * window.innerWidth
    const py = e.y * window.innerHeight

    if (e.gesture === 'cursor' || e.gesture === 'none') {
      // Hover detection
      const el = document.elementFromPoint(px, py)
      const card = el?.closest('[data-note-id]') as HTMLElement | null
      setHoveredId(card ? card.dataset.noteId! : null)
      if (e.gesture === 'none') {
        setGrabbedNote(null)
        setOverTrash(false)
      }
    }

    if (e.gesture === 'pinch') {
      setGhostPos({ x: px, y: py })

      if (e.isNew && !grabbedNote) {
        // Try to grab a note under the cursor
        const el = document.elementFromPoint(px, py)
        const card = el?.closest('[data-note-id]') as HTMLElement | null
        if (card) {
          const noteId = card.dataset.noteId!
          setNotes(prev => {
            const found = prev.find(n => n.id === noteId)
            if (found) setGrabbedNote(found)
            return prev
          })
        }
      }

      // Check if over trash
      if (trashRef.current) {
        const rect = trashRef.current.getBoundingClientRect()
        const isOver = px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
        setOverTrash(isOver)
      }
    }

    if (e.gesture !== 'pinch' && grabbedNote) {
      // Released — if over trash, delete
      if (overTrash) {
        setNotes(prev => {
          const newNotes = prev.filter(n => n.id !== grabbedNote.id)
          // persist via ref to avoid stale closure
          persistRef.current(newNotes)
          return newNotes
        })
      }
      setGrabbedNote(null)
      setOverTrash(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grabbedNote, overTrash]))

  useEffect(() => {
    loadNotes()
    const ch = supabase.channel(`quicknotes:${roomCode}`)
      .on('broadcast', { event: 'notes-changed' }, ({ payload }) => {
        isRemote.current = true
        setNotes(payload.notes ?? [])
        isRemote.current = false
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomCode])

  async function loadNotes() {
    const { data } = await supabase.from('room_notes')
      .select('content').eq('room_code', roomCode).single()
    if (data?.content) {
      try { setNotes(JSON.parse(data.content)) } catch {}
    }
  }

  async function persist(newNotes: StickyNote[]) {
    setNotes(newNotes)
    setSaving(true)
    supabase.channel(`quicknotes:${roomCode}`).send({
      type: 'broadcast', event: 'notes-changed', payload: { notes: newNotes },
    })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const json = JSON.stringify(newNotes)
      await supabase.from('room_notes')
        .upsert({ room_code: roomCode, content: json, updated_at: new Date().toISOString() })
      setSaving(false)
    }, 800)
  }

  // Stable ref so gesture closure can call persist without going stale
  const persistRef = useRef(persist)
  useEffect(() => { persistRef.current = persist })

  function addNote() {
    const newNote: StickyNote = {
      id: crypto.randomUUID(),
      title: '',
      text: '',
      color: COLORS[notes.length % COLORS.length].bg,
      createdAt: new Date().toISOString(),
    }
    setEditing(newNote)
    persist([...notes, newNote])
  }

  function saveNote(updated: StickyNote) {
    persist(notes.map(n => n.id === updated.id ? updated : n))
  }

  function deleteNote(id: string) {
    persist(notes.filter(n => n.id !== id))
    setEditing(null)
  }

  useJarvisHandler(useCallback(async (command) => {
    if (command.action === 'add_note') {
      addNote()
      return true
    }

    if (command.action === 'delete_note') {
      const targetId = editing?.id ?? notes[notes.length - 1]?.id
      if (!targetId) return true
      deleteNote(targetId)
      return true
    }

    return false
  }, [addNote, deleteNote, editing, notes]))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Cork board header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#92400e',
        borderBottom: '3px solid #78350f', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📌</span>
          <div>
            <p style={{ color: '#fde68a', fontWeight: 700, fontSize: 14, fontFamily: 'sans-serif', margin: 0 }}>
              Pizzarrón de notas
            </p>
            <p style={{ color: '#d97706', fontSize: 11, fontFamily: 'sans-serif', margin: 0 }}>
              {notes.length} nota{notes.length !== 1 ? 's' : ''} · sala {roomCode}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#d97706', fontFamily: 'sans-serif' }}>
            {saving ? 'Guardando...' : ''}
          </span>
          <button onClick={addNote} style={{
            background: '#fef08a', border: '2px solid #facc15', borderRadius: 6,
            padding: '6px 14px', cursor: 'pointer', fontWeight: 700,
            fontSize: 13, fontFamily: 'sans-serif', color: '#78350f',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}>
            + Nueva nota
          </button>
        </div>
      </div>

      {/* Cork board */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '32px 28px',
        background: '#b5813a',
        backgroundImage: `
          repeating-linear-gradient(0deg,
            transparent 0px, transparent 3px,
            rgba(255,220,140,0.07) 3px, rgba(255,220,140,0.07) 4px,
            transparent 4px, transparent 8px,
            rgba(100,60,10,0.06) 8px, rgba(100,60,10,0.06) 9px
          ),
          repeating-linear-gradient(90deg,
            transparent 0px, transparent 5px,
            rgba(80,40,5,0.05) 5px, rgba(80,40,5,0.05) 6px,
            transparent 6px, transparent 14px,
            rgba(255,200,100,0.04) 14px, rgba(255,200,100,0.04) 15px
          ),
          radial-gradient(ellipse at 20% 20%, rgba(220,170,80,0.35) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 80%, rgba(140,80,20,0.30) 0%, transparent 45%),
          radial-gradient(ellipse at 60% 40%, rgba(190,140,60,0.20) 0%, transparent 40%)
        `,
      }}>
        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>📌</p>
            <p style={{ color: '#92400e', fontSize: 16, fontFamily: 'sans-serif', fontWeight: 600 }}>
              El pizzarrón está vacío
            </p>
            <p style={{ color: '#a16207', fontSize: 13, fontFamily: 'sans-serif', marginTop: 6 }}>
              Creá una nota con el botón de arriba
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '40px 32px',
            padding: '10px 4px 20px',
          }}>
            {notes.map((note, i) => (
              <NoteCard key={note.id} note={note} index={i}
                onClick={() => setEditing(note)}
                hovered={hoveredId === note.id}
                grabbed={grabbedNote?.id === note.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trash zone — gesture drop target */}
      <div
        ref={trashRef}
        style={{
          position: 'absolute', bottom: 24, right: 24,
          width: 72, height: 72, borderRadius: '50%',
          background: overTrash ? 'rgba(220,38,38,0.8)' : 'rgba(0,0,0,0.35)',
          border: `2px dashed ${overTrash ? '#f87171' : 'rgba(255,255,255,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, transition: 'all 0.2s',
          transform: overTrash ? 'scale(1.2)' : 'scale(1)',
          zIndex: 20,
          boxShadow: overTrash ? '0 0 24px rgba(220,38,38,0.6)' : 'none',
          pointerEvents: 'none',
          opacity: grabbedNote ? 1 : 0.4,
        }}
      >
        🗑
      </div>

      {/* Ghost note following gesture cursor while dragging */}
      {grabbedNote && (
        <div style={{
          position: 'fixed',
          left: ghostPos.x, top: ghostPos.y,
          transform: 'translate(-50%, -50%) rotate(-5deg) scale(0.85)',
          pointerEvents: 'none', zIndex: 9990,
          background: getColor(grabbedNote.color).bg,
          borderBottom: `3px solid ${getColor(grabbedNote.color).border}`,
          borderRadius: 2, padding: '12px', width: 120,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          opacity: 0.9, fontSize: 11, fontFamily: 'sans-serif',
          color: '#3a2a10', fontWeight: 600,
        }}>
          {grabbedNote.title || grabbedNote.text.slice(0, 30) || '📝'}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <NoteModal
          note={editing}
          onSave={saveNote}
          onDelete={() => deleteNote(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
