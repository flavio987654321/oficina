'use client'

import { useEffect, useRef } from 'react'
import { Tldraw, useEditor, TLRecord } from 'tldraw'
import 'tldraw/tldraw.css'
import { supabase } from '@/lib/supabase'
import { useGesture } from '@/lib/useGesture'

// ── Real-time sync ───────────────────────────────────────────
function SyncPlugin({ roomCode, userName }: { roomCode: string; userName: string }) {
  const editor = useEditor()
  const isApplyingRemote = useRef(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!editor) return

    const channel = supabase.channel(`wb-${roomCode}`)
    channelRef.current = channel

    channel.on('broadcast', { event: 'wb' }, ({ payload }) => {
      if (!payload || isApplyingRemote.current) return
      isApplyingRemote.current = true
      try {
        editor.store.mergeRemoteChanges(() => {
          const { put, remove } = payload
          if (put?.length) editor.store.put(put)
          if (remove?.length) editor.store.remove(remove)
        })
      } finally {
        isApplyingRemote.current = false
      }
    })

    channel.subscribe()

    const unsub = editor.store.listen((entry) => {
      if (isApplyingRemote.current) return
      if (entry.source !== 'user') return

      const put: TLRecord[] = [
        ...Object.values(entry.changes.added) as TLRecord[],
        ...Object.values(entry.changes.updated).map(([, next]) => next) as TLRecord[],
      ]
      const remove = Object.values(entry.changes.removed).map((r) => (r as TLRecord).id)
      if (put.length === 0 && remove.length === 0) return

      channel.send({ type: 'broadcast', event: 'wb', payload: { put, remove, by: userName } })
    })

    return () => {
      unsub()
      supabase.removeChannel(channel)
    }
  }, [editor, roomCode, userName])

  return null
}

// ── Gesture → pointer event bridge ──────────────────────────
function GesturePlugin() {
  const editor = useEditor()
  const isPinching = useRef(false)
  const lastTool   = useRef<string>('draw')

  // Helper: inject a synthetic pointer event on the tldraw canvas
  function fire(type: string, clientX: number, clientY: number, buttons = 0) {
    const canvas = document.querySelector('.tl-canvas') as HTMLElement
    if (!canvas) return
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true,
      clientX, clientY,
      pointerId: 99, pointerType: 'pen',
      pressure: buttons ? 0.5 : 0,
      buttons,
    }))
  }

  useGesture((e) => {
    if (!editor) return
    const px = e.x * window.innerWidth
    const py = e.y * window.innerHeight

    switch (e.gesture) {
      case 'cursor':
        // Index finger = move pointer only
        if (isPinching.current) {
          fire('pointerup', px, py, 0)
          isPinching.current = false
        }
        editor.setCurrentTool('select')
        fire('pointermove', px, py, 0)
        break

      case 'pinch':
        // Pinch = draw
        if (!isPinching.current) {
          editor.setCurrentTool('draw')
          lastTool.current = 'draw'
          fire('pointerdown', px, py, 1)
          isPinching.current = true
        } else {
          fire('pointermove', px, py, 1)
        }
        break

      case 'open':
        // Open palm = stop drawing / select tool
        if (isPinching.current) {
          fire('pointerup', px, py, 0)
          isPinching.current = false
        }
        editor.setCurrentTool('select')
        break

      case 'fist':
        // Fist = eraser
        if (isPinching.current) {
          fire('pointerup', px, py, 0)
          isPinching.current = false
        }
        if (e.isNew) editor.setCurrentTool('eraser')
        break

      case 'none':
        if (isPinching.current) {
          fire('pointerup', px, py, 0)
          isPinching.current = false
        }
        break
    }
  })

  return null
}

// ── Main component ───────────────────────────────────────────
export default function Whiteboard({ roomCode, userName }: { roomCode: string; userName: string }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Tldraw inferDarkMode>
        <SyncPlugin roomCode={roomCode} userName={userName} />
        <GesturePlugin />
      </Tldraw>
    </div>
  )
}
