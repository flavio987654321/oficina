'use client'

/**
 * GestureOverlay
 * - Requests webcam access
 * - Starts GestureEngine
 * - Shows a visual hand cursor + gesture label on screen
 * - Small webcam preview in corner (can be hidden)
 */

import { useEffect, useRef, useState } from 'react'
import { gestureEngine, type GestureEvent, type GestureName } from '@/lib/GestureEngine'

const GESTURE_LABELS: Record<GestureName, string> = {
  cursor:      '☝️ Cursor',
  pinch:       '🤏 Agarrando',
  open:        '✋ Abierta',
  fist:        '👊 Puño',
  swipe_left:  '👈 Izquierda',
  swipe_right: '👉 Derecha',
  victory:     '✌️ Volver',
  none:        '',
}

const CURSOR_COLORS: Record<GestureName, string> = {
  cursor:      '#60a0d0',
  pinch:       '#fbbf24',
  open:        '#4ade80',
  fist:        '#f87171',
  swipe_left:  '#c084fc',
  swipe_right: '#c084fc',
  victory:     '#34d399',
  none:        'transparent',
}

export default function GestureOverlay({ onReady }: { onReady?: () => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const [status,    setStatus]    = useState<'loading' | 'ready' | 'error'>('loading')
  const [gesture,   setGesture]   = useState<GestureEvent | null>(null)
  const [showCam,   setShowCam]   = useState(true)

  useEffect(() => {
    let stream: MediaStream | null = null

    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        await gestureEngine.start(videoRef.current)
        setStatus('ready')
        onReady?.()
      } catch (e) {
        console.error('GestureOverlay error:', e)
        setStatus('error')
      }
    }

    init()

    const handleGesture = (e: GestureEvent) => setGesture(e)
    gestureEngine.on(handleGesture)

    return () => {
      gestureEngine.off(handleGesture)
      gestureEngine.stop()
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const color = gesture ? CURSOR_COLORS[gesture.gesture] : 'transparent'
  const label = gesture ? GESTURE_LABELS[gesture.gesture] : ''

  return (
    <>
      {/* Hand cursor dot */}
      {gesture && gesture.gesture !== 'none' && (
        <div style={{
          position: 'fixed',
          left: `${gesture.x * 100}%`,
          top:  `${gesture.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          pointerEvents: 'none',
          transition: 'left 0.04s linear, top 0.04s linear',
        }}>
          {/* Outer ring */}
          <div style={{
            width:  gesture.gesture === 'pinch' ? 28 : 20,
            height: gesture.gesture === 'pinch' ? 28 : 20,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            opacity: 0.7,
            transition: 'all 0.1s',
          }} />
          {/* Inner dot */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 6, height: 6, borderRadius: '50%',
            background: color,
          }} />
        </div>
      )}

      {/* Gesture label */}
      {label && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          border: `1px solid ${color}40`,
          borderRadius: 20, padding: '6px 16px',
          color: color, fontSize: 13, fontFamily: 'sans-serif',
          fontWeight: 600, letterSpacing: '0.03em',
          transition: 'color 0.15s',
        }}>
          {label}
        </div>
      )}

      {/* Status loading */}
      {status === 'loading' && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: '8px 14px',
          color: '#a08050', fontSize: 12, fontFamily: 'sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 12, height: 12,
            border: '2px solid rgba(255,200,100,0.3)', borderTopColor: '#c9935a',
            borderRadius: '50%', display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
          Iniciando cámara...
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          background: 'rgba(127,29,29,0.9)', borderRadius: 10, padding: '8px 14px',
          color: '#fecaca', fontSize: 12, fontFamily: 'sans-serif',
        }}>
          ⚠️ No se pudo acceder a la cámara
        </div>
      )}

      {/* Webcam preview */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9998,
        borderRadius: 10, overflow: 'hidden',
        border: '2px solid rgba(255,200,100,0.2)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        display: status === 'ready' ? 'block' : 'none',
        cursor: 'pointer',
      }}
        onClick={() => setShowCam(s => !s)}
        title={showCam ? 'Ocultar cámara' : 'Mostrar cámara'}
      >
        <video
          ref={videoRef}
          style={{
            width: showCam ? 140 : 0,
            height: showCam ? 80 : 0,
            display: 'block',
            transform: 'scaleX(-1)',  // mirror
            objectFit: 'cover',
          }}
          muted playsInline
        />
        {!showCam && (
          <div style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', color: '#c9935a', fontSize: 16,
          }}>📷</div>
        )}
      </div>
    </>
  )
}
