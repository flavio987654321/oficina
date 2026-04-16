'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  VideoTrack,
  AudioTrack,
  useTracks,
  type TrackReference,
} from '@livekit/components-react'
import { Track, Participant } from 'livekit-client'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { dispatchJarvisCommand, useJarvisHandler } from '@/lib/jarvisBus'

const Whiteboard  = dynamic(() => import('./Whiteboard'),  { ssr: false })
const Notebook    = dynamic(() => import('./Notebook'),    { ssr: false })
const QuickNotes  = dynamic(() => import('./QuickNotes'),  { ssr: false })

export type Panel = null | 'pizarra' | 'cuaderno' | 'notas'

const MAX_SEATS = 6
const TABLE_R   = 120
const SEAT_R    = 220

function getCameraTrackRef(participant: Participant): TrackReference | undefined {
  const publication = participant.getTrackPublication(Track.Source.Camera)
  if (!publication) return undefined

  return {
    participant,
    publication,
    source: Track.Source.Camera,
  }
}

// ─────────────────────────────────────────────────────────
// Desk objects — realistic SVG items that sit on the table
// ─────────────────────────────────────────────────────────

function SVGNotebook({ projectCount }: { projectCount: number }) {
  return (
    <div className="relative select-none" style={{ width: 42, height: 54 }}>
      <svg width="42" height="54" viewBox="0 0 42 54" fill="none">
        {/* Page stack (right edge peek) */}
        <rect x="9" y="4"  width="31" height="46" rx="2" fill="#ede8dc" />
        <rect x="9" y="5"  width="29" height="44" rx="1.5" fill="#f5f1e8" />
        <rect x="9" y="6"  width="27" height="42" rx="1" fill="#faf7f2" />
        {/* Cover */}
        <rect x="3" y="2"  width="30" height="50" rx="3" fill="#1b4332" />
        {/* Cover highlight (top-left gloss) */}
        <rect x="3" y="2"  width="30" height="22" rx="3" fill="rgba(255,255,255,0.06)" />
        {/* Ruling lines on cover */}
        {[16, 22, 28, 34, 40].map(y => (
          <line key={y} x1="8" y1={y} x2="30" y2={y}
            stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        ))}
        {/* Spiral binding */}
        {[9, 15, 21, 27, 33, 39, 45].map(y => (
          <g key={y}>
            <path d={`M 2 ${y} Q 5 ${y - 2} 5 ${y + 2} Q 5 ${y + 4} 2 ${y + 2}`}
              stroke="#b8a060" strokeWidth="1.4" fill="none" />
          </g>
        ))}
        {/* Title label */}
        <rect x="8" y="7" width="22" height="7" rx="1" fill="rgba(255,255,255,0.12)" />
        <text x="19" y="13" textAnchor="middle" fontSize="4.5"
          fill="rgba(255,255,255,0.75)" fontFamily="sans-serif" fontWeight="bold"
          letterSpacing="0.5">NOTAS</text>
        {/* Bottom corner dog-ear */}
        <path d="M 27 45 L 33 45 L 33 51 Z" fill="rgba(255,255,255,0.08)" />
      </svg>

      {/* Project count badge */}
      {projectCount > 0 && (
        <div className="absolute -top-1.5 -right-1 flex items-center justify-center
          bg-red-500 text-white font-bold rounded-full shadow-md"
          style={{ fontSize: 8, width: 16, height: 16, lineHeight: 1 }}>
          {projectCount > 9 ? '9+' : projectCount}
        </div>
      )}
    </div>
  )
}

function SVGStickyPad() {
  return (
    <svg width="38" height="40" viewBox="0 0 38 40" fill="none">
      {/* Shadow pages underneath */}
      <rect x="4" y="4"  width="32" height="35" rx="2" fill="#fbbf24" opacity="0.4" />
      <rect x="2" y="2"  width="32" height="35" rx="2" fill="#fcd34d" opacity="0.6" />
      {/* Main page */}
      <rect x="0" y="0"  width="32" height="35" rx="2" fill="#fef08a" />
      {/* Top binding strip */}
      <rect x="0" y="0"  width="32" height="5"  rx="2" fill="#facc15" />
      <rect x="0" y="3"  width="32" height="2"  fill="#facc15" />
      {/* Ruled lines */}
      {[11, 17, 23, 29].map(y => (
        <line key={y} x1="4" y1={y} x2="28" y2={y}
          stroke="#fde68a" strokeWidth="1" />
      ))}
      {/* Pencil scribble (3 short lines simulating handwriting) */}
      <line x1="4"  y1="11" x2="20" y2="11" stroke="#a16207" strokeWidth="1.2" opacity="0.5" />
      <line x1="4"  y1="17" x2="24" y2="17" stroke="#a16207" strokeWidth="1.2" opacity="0.5" />
      <line x1="4"  y1="23" x2="14" y2="23" stroke="#a16207" strokeWidth="1.2" opacity="0.5" />
      {/* Dog-ear bottom-right */}
      <path d="M 26 35 L 32 29 L 32 35 Z" fill="#fde047" />
      <path d="M 26 35 L 32 29" stroke="#facc15" strokeWidth="0.8" />
    </svg>
  )
}

function SVGMarker() {
  return (
    <svg width="13" height="56" viewBox="0 0 13 56" fill="none" style={{ display: 'block' }}>
      {/* Cap */}
      <rect x="1.5" y="0" width="10" height="15" rx="3" fill="#1a56db" />
      <rect x="1.5" y="0" width="10" height="8"  rx="3" fill="#2563eb" />
      {/* Cap clip ring */}
      <rect x="1.5" y="13" width="10" height="2.5" rx="0" fill="#1e40af" />
      {/* Body */}
      <rect x="1.5" y="15" width="10" height="30" rx="1" fill="#e5e7eb" />
      {/* Body left shadow */}
      <rect x="1.5" y="15" width="3"  height="30" rx="1" fill="rgba(0,0,0,0.08)" />
      {/* Body highlight */}
      <rect x="4"   y="15" width="2"  height="30" rx="1" fill="rgba(255,255,255,0.5)" />
      {/* Grip zone */}
      {[34, 37, 40, 43].map(y => (
        <rect key={y} x="1.5" y={y} width="10" height="1.5" rx="0.75"
          fill="rgba(0,0,0,0.10)" />
      ))}
      {/* Taper to tip */}
      <path d="M1.5 45 L6.5 56 L11.5 45 Z" fill="#374151" />
      {/* Tip highlight */}
      <path d="M4.5 45 L6.5 50 L5.5 45 Z" fill="rgba(255,255,255,0.2)" />
    </svg>
  )
}

// Each item on the table: position + rotation + shadow = 3D resting feel
function TableItem({
  id, x, y, rotate, active, children, onClick,
}: {
  id: Panel; x: number; y: number; rotate: number
  active: boolean; children: React.ReactNode; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={id === 'pizarra' ? 'Pizarra' : 'Cuaderno de notas'}
      style={{
        position: 'absolute',
        left: `calc(50% + ${x}px)`,
        top:  `calc(50% + ${y}px)`,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${active ? 1.18 : 1})`,
        filter: active
          ? `drop-shadow(0px 0px 8px rgba(59,130,246,0.8)) drop-shadow(3px 8px 10px rgba(0,0,0,0.65))`
          : `drop-shadow(3px 9px 10px rgba(0,0,0,0.70))`,
        transition: 'transform 0.18s ease, filter 0.18s ease',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        zIndex: 3,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.transform =
          `translate(-50%, -50%) rotate(${rotate}deg) scale(1.12)`
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.transform =
          `translate(-50%, -50%) rotate(${rotate}deg) scale(1)`
      }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────
// Wood grain table surface
// ─────────────────────────────────────────────────────────
function WoodTable({
  activePanel, onToggle, projectCount,
}: {
  activePanel: Panel
  onToggle:    (id: Panel) => void
  projectCount: number
}) {
  const size = TABLE_R * 2
  const cx   = size / 2
  const cy   = size / 2
  const r    = size / 2 - 4

  const grainLines = Array.from({ length: 24 }, (_, i) => {
    const x  = (i / 24) * (size + 80) - 40
    const w1 = 9 * Math.sin(i * 0.8 + 1.0)
    const w2 = 6 * Math.sin(i * 1.5 + 0.3)
    const w3 = 4 * Math.sin(i * 0.4 + 2.1)
    return `M ${x} 0 C ${x + w1} ${cy * 0.4} ${x + w2} ${cy * 1.0} ${x + w3} ${size}`
  })
  const rings = [r * 0.82, r * 0.63, r * 0.46, r * 0.30, r * 0.16]

  return (
    <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
      {/* Drop shadow under table */}
      <div style={{
        position: 'absolute', inset: 0, top: 18, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,0,0,0.55) 0%, transparent 65%)',
        filter: 'blur(22px)', zIndex: 0,
      }} />

      {/* Table SVG */}
      <svg width={size} height={size} style={{ display: 'block', position: 'relative', zIndex: 1 }}>
        <defs>
          <clipPath id="tbl-clip"><circle cx={cx} cy={cy} r={r} /></clipPath>
          <radialGradient id="tbl-base" cx="42%" cy="36%" r="65%">
            <stop offset="0%"   stopColor="#d9a86c" />
            <stop offset="45%"  stopColor="#a97040" />
            <stop offset="100%" stopColor="#5a3215" />
          </radialGradient>
          <radialGradient id="tbl-shine" cx="30%" cy="26%" r="52%">
            <stop offset="0%"   stopColor="rgba(255,240,185,0.60)" />
            <stop offset="55%"  stopColor="rgba(255,210,130,0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="tbl-glow" cx="72%" cy="74%" r="45%">
            <stop offset="0%"   stopColor="rgba(200,130,50,0.25)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="tbl-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="52%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(15,4,0,0.65)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="url(#tbl-base)" />
        <g clipPath="url(#tbl-clip)">
          {grainLines.map((d, i) => (
            <path key={i} d={d} fill="none"
              stroke={i % 4 === 0 ? 'rgba(55,22,4,0.20)' : 'rgba(170,100,35,0.09)'}
              strokeWidth={i % 6 === 0 ? 1.8 : 0.9} />
          ))}
        </g>
        <g clipPath="url(#tbl-clip)" opacity="0.08">
          {rings.map((rr, i) => (
            <ellipse key={i} cx={cx + 6} cy={cy + 10} rx={rr} ry={rr * 0.91}
              fill="none" stroke="rgba(50,18,2,0.9)" strokeWidth="1.4" />
          ))}
        </g>
        <circle cx={cx} cy={cy} r={r} fill="url(#tbl-shine)" />
        <circle cx={cx} cy={cy} r={r} fill="url(#tbl-glow)" />
        <circle cx={cx} cy={cy} r={r} fill="url(#tbl-vignette)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e0a02" strokeWidth="7" />
        <circle cx={cx} cy={cy} r={r - 7} fill="none" stroke="rgba(210,155,75,0.30)" strokeWidth="2" />
      </svg>

      {/* Cuaderno de proyectos — arriba izquierda */}
      <TableItem id="cuaderno" x={-30} y={-28} rotate={-12}
        active={activePanel === 'cuaderno'} onClick={() => onToggle('cuaderno')}>
        <SVGNotebook projectCount={projectCount} />
      </TableItem>

      {/* Block de notas rápidas — arriba derecha */}
      <TableItem id="notas" x={28} y={-22} rotate={8}
        active={activePanel === 'notas'} onClick={() => onToggle('notas')}>
        <SVGStickyPad />
      </TableItem>

      {/* Marcador pizarra — abajo centro */}
      <TableItem id="pizarra" x={4} y={30} rotate={-18}
        active={activePanel === 'pizarra'} onClick={() => onToggle('pizarra')}>
        <SVGMarker />
      </TableItem>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Chair
// ─────────────────────────────────────────────────────────
function ChairShape({ color = '#94a3b8' }: { color?: string }) {
  return (
    <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
      <rect x="4" y="0" width="36" height="8" rx="4" fill={color} opacity="0.7" />
      <rect x="6" y="8" width="4" height="12" rx="2" fill={color} opacity="0.5" />
      <rect x="34" y="8" width="4" height="12" rx="2" fill={color} opacity="0.5" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────
// Seat avatar
// ─────────────────────────────────────────────────────────
function SeatAvatar({
  name, isLocal = false, isLeader = false,
  isCamOn = false, isMicOn = false, isSpeaking = false,
  track, angle, onToggleMic, onToggleCam, onMuteLocally, visible = true, mediaError,
}: {
  name: string; isLocal?: boolean; isLeader?: boolean
  isCamOn?: boolean; isMicOn?: boolean; isSpeaking?: boolean
  track?: TrackReference; angle: number
  onToggleMic?: () => void; onToggleCam?: () => void; onMuteLocally?: () => void
  visible?: boolean
  mediaError?: string
}) {
  const x = Math.cos(angle) * SEAT_R
  const y = Math.sin(angle) * SEAT_R
  const borderColor = isSpeaking ? '#22c55e' : isLocal ? '#3b82f6' : isLeader ? '#f59e0b' : '#cbd5e1'

  return (
    <div className="absolute flex flex-col items-center" style={{
      left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`,
      transform: 'translate(-50%, -50%)', width: 90,
      opacity: visible ? 1 : 0.22,
      animation: visible ? 'fadeInSeat 0.4s ease-out' : 'none',
    }}>
      <div className="mb-[-6px] z-0">
        <ChairShape color={isLocal ? '#3b82f6' : isLeader ? '#f59e0b' : '#94a3b8'} />
      </div>
      <div className="relative rounded-full overflow-hidden shadow-lg z-10 transition-all duration-300" style={{
        width: 64, height: 64, border: `3px solid ${borderColor}`,
        boxShadow: isSpeaking
          ? `0 0 0 4px rgba(34,197,94,0.35), 0 0 18px rgba(34,197,94,0.45)`
          : `0 4px 14px rgba(0,0,0,0.45)`,
      }}>
        {track ? (
          <VideoTrack trackRef={track} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{
            background: isLocal ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
              : isLeader ? 'linear-gradient(135deg,#f59e0b,#b45309)'
              : 'linear-gradient(135deg,#6366f1,#4338ca)',
          }}>
            <span className="text-white font-bold text-xl">{name?.[0]?.toUpperCase() || '?'}</span>
          </div>
        )}
        {isLocal && (
          <div className="absolute top-0.5 right-0.5 bg-blue-500 text-white text-[8px] px-1 rounded-full leading-tight">Vos</div>
        )}
        {isSpeaking && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1 rounded-full bg-green-400"
                style={{ height: 6 + i * 2, animation: `soundBar 0.6s ${i * 0.1}s infinite alternate ease-in-out` }} />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 mt-1 z-10">
        {isLeader && <span className="text-xs">👑</span>}
        <span className="text-xs font-semibold text-gray-100 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full shadow-sm truncate" style={{ maxWidth: 80 }}>
          {name}
        </span>
      </div>
      {isLocal && (
        <div className="flex gap-2 mt-1.5 z-10">
          <button onClick={onToggleMic}
            title={isMicOn ? 'Apagar microfono' : 'Encender microfono'}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shadow transition-all ${isMicOn ? 'bg-white text-gray-700' : 'bg-red-500 text-white'}`}>
            {isMicOn ? '🎤' : '🔇'}
          </button>
          <button onClick={onToggleCam}
            title={isCamOn ? 'Apagar camara' : 'Encender camara'}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shadow transition-all ${isCamOn ? 'bg-white text-gray-700' : 'bg-red-500 text-white'}`}>
            {isCamOn ? '📷' : '📵'}
          </button>
        </div>
      )}
      {mediaError ? (
        <span className="text-[10px] font-semibold text-red-200 bg-red-950/70 px-2 py-1 rounded-full mt-1 text-center shadow-sm z-10">
          {mediaError}
        </span>
      ) : null}
      {!isLocal && visible && (
        <button onClick={onMuteLocally}
          className="mt-1 text-xs text-gray-300 hover:text-white opacity-0 hover:opacity-100 bg-black/50 px-1.5 py-0.5 rounded-full shadow-sm z-10 transition">
          🔇
        </button>
      )}
    </div>
  )
}

function RemoteSeat({ participant, isLeader, angle, onMute }: {
  participant: Participant; isLeader: boolean; angle: number; onMute: () => void
}) {
  const isSpeaking = useIsSpeaking(participant)
  const track = getCameraTrackRef(participant)
  return (
    <SeatAvatar name={participant.name || 'Usuario'} isLeader={isLeader}
      isSpeaking={isSpeaking} track={track} angle={angle} onMuteLocally={onMute} visible />
  )
}

function LocalSeat({ userId, leaderUserId, userName, angle }: {
  userId: string; leaderUserId?: string; userName: string; angle: number
}) {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant()
  const isSpeaking = useIsSpeaking(localParticipant)
  const [mediaError, setMediaError] = useState('')
  const track = getCameraTrackRef(localParticipant)
  return (
    <SeatAvatar name={localParticipant.name || userName} isLocal
      isLeader={userId === leaderUserId}
      isCamOn={isCameraEnabled} isMicOn={isMicrophoneEnabled}
      isSpeaking={isSpeaking} track={track} angle={angle}
      onToggleMic={async () => {
        setMediaError('')
        try {
          await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
        } catch {
          setMediaError('No pude abrir el microfono')
        }
      }}
      onToggleCam={async () => {
        setMediaError('')
        try {
          await localParticipant.setCameraEnabled(!isCameraEnabled, { facingMode: 'user' })
        } catch {
          setMediaError(localParticipant.lastCameraError?.message || 'No pude abrir la camara')
        }
      }}
      mediaError={mediaError}
      visible />
  )
}

// ─────────────────────────────────────────────────────────
// Main layout
// ─────────────────────────────────────────────────────────
export default function RoomLayout({ roomCode, userId, userName, leaderUserId, onPanelOpen, onPanelClose, onPanelChange }: {
  roomCode: string; userId: string; userName: string; leaderUserId?: string
  onPanelOpen?: (closeFn: () => void) => void
  onPanelClose?: () => void
  onPanelChange?: (panel: Panel) => void
}) {
  const participants       = useParticipants()
  const audioTracks        = useTracks([Track.Source.Microphone], { onlySubscribed: true })
  const remoteParticipants = participants.slice(0, MAX_SEATS - 1)
  const baseContainerSize  = (SEAT_R + 120) * 2
  const [sceneScale, setSceneScale] = useState(1)

  useEffect(() => {
    const updateSceneScale = () => {
      const availableWidth = window.innerWidth - 20
      const availableHeight = window.innerHeight - 96
      const nextScale = Math.min(1, availableWidth / baseContainerSize, availableHeight / baseContainerSize)
      setSceneScale(Math.max(0.54, nextScale))
    }

    updateSceneScale()
    window.addEventListener('resize', updateSceneScale)

    return () => window.removeEventListener('resize', updateSceneScale)
  }, [baseContainerSize])

  const containerSize = baseContainerSize * sceneScale

  // Project count badge
  const [projectCount, setProjectCount] = useState(0)
  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('room_code', roomCode)
      setProjectCount(count ?? 0)
    }
    fetchCount()
    // Update when notebook is used
    const ch = supabase.channel(`projcount:${roomCode}`)
      .on('broadcast', { event: 'project-created' }, () => fetchCount())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomCode])

  // ── zoom+dissolve ──
  const [panelContent, setPanelContent] = useState<Panel>(null)
  const [sceneAnim,    setSceneAnim]    = useState<'none' | 'out' | 'in'>('none')
  const [sceneHidden,  setSceneHidden]  = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  function later(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms); timers.current.push(t)
  }

  function openPanel(id: Panel) {
    setSceneAnim('out')
    later(() => {
      setSceneHidden(true)
      setPanelContent(id)
      setSceneAnim('none')
      onPanelOpen?.(closePanel)
    }, 400)
  }
  function closePanel() {
    setPanelContent(null); setSceneHidden(false); setSceneAnim('in')
    later(() => setSceneAnim('none'), 420)
    onPanelClose?.()
  }
  function handleDesk(id: Panel) {
    if (panelContent === id) { closePanel(); return }
    if (panelContent) { setPanelContent(id); return }
    openPanel(id)
  }

  useEffect(() => { onPanelChange?.(panelContent) }, [onPanelChange, panelContent])

  useJarvisHandler(useCallback(async (command) => {
    if (command.action === 'open_panel' && command.panel) {
      handleDesk(command.panel)
      return true
    }

    if (command.action === 'close_panel') {
      if (panelContent) closePanel()
      return true
    }

    if ((command.action === 'next_page' || command.action === 'previous_page') && panelContent !== 'cuaderno') {
      handleDesk('cuaderno')
      window.setTimeout(() => { void dispatchJarvisCommand(command) }, 450)
      return true
    }

    if ((command.action === 'add_note' || command.action === 'delete_note') && panelContent !== 'notas') {
      handleDesk('notas')
      window.setTimeout(() => { void dispatchJarvisCommand(command) }, 450)
      return true
    }

    return false
  }, [panelContent]))

  function getAngle(i: number) { return (2 * Math.PI * i) / MAX_SEATS - Math.PI / 2 }

  const sceneStyle: React.CSSProperties =
    sceneAnim === 'out' ? { animation: 'sceneOut 0.40s ease-in  forwards' } :
    sceneAnim === 'in'  ? { animation: 'sceneIn  0.42s ease-out forwards' } : {}

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

      {/* Parquet floor */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg,
            rgba(60,30,5,0.13) 0px, rgba(60,30,5,0.13) 1px,
            transparent 1px, transparent 62px),
          repeating-linear-gradient(90deg,
            rgba(60,30,5,0.07) 0px, rgba(60,30,5,0.07) 1px,
            transparent 1px, transparent 124px)
        `,
        backgroundColor: '#B8834A',
      }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `repeating-linear-gradient(0deg,
          rgba(255,220,150,0.06) 0px, rgba(255,220,150,0.06) 31px,
          rgba(0,0,0,0.04) 31px, rgba(0,0,0,0.04) 62px)`,
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,210,130,0.18) 0%, rgba(30,14,4,0.55) 100%)',
      }} />
      <div className="absolute pointer-events-none" style={{
        left: '50%', top: '48%', transform: 'translate(-50%, -50%)',
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,230,170,0.14) 0%, transparent 65%)',
      }} />

      <style>{`
        @keyframes fadeInSeat {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.82); }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }
        @keyframes soundBar {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.5); }
        }
        @keyframes sceneOut {
          from { opacity: 1; transform: scale(1);    filter: blur(0px); }
          to   { opacity: 0; transform: scale(1.45); filter: blur(4px); }
        }
        @keyframes sceneIn {
          from { opacity: 0; transform: scale(1.45); filter: blur(4px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0px); }
        }
        @keyframes panelIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {audioTracks.map(t => <AudioTrack key={t.participant.sid} trackRef={t} />)}

      {/* Scene */}
      {!sceneHidden && (
        <div className="absolute inset-0 flex items-center justify-center" style={sceneStyle}>
          <div className="relative" style={{ width: containerSize, height: containerSize }}>
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: baseContainerSize,
                height: baseContainerSize,
                transform: `translate(-50%, -50%) scale(${sceneScale})`,
                transformOrigin: 'center',
              }}
            >

            <WoodTable activePanel={panelContent} onToggle={handleDesk} projectCount={projectCount} />

            {Array.from({ length: MAX_SEATS - 1 }).map((_, i) => {
              const p     = remoteParticipants[i]
              const angle = getAngle(i)
              if (p) return (
                <RemoteSeat key={p.sid} participant={p}
                  isLeader={p.identity === leaderUserId}
                  angle={angle} onMute={() => {}} />
              )
              const x = Math.cos(angle) * SEAT_R
              const y = Math.sin(angle) * SEAT_R
              return (
                <div key={`ghost-${i}`} className="absolute flex flex-col items-center" style={{
                  left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)', width: 90, opacity: 0.28,
                }}>
                  <div className="mb-[-6px]"><ChairShape /></div>
                  <div className="rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center"
                    style={{ width: 64, height: 64, background: 'rgba(148,163,184,0.10)' }}>
                    <span className="text-2xl">👤</span>
                  </div>
                  <span className="text-xs text-gray-300 mt-1 bg-black/40 px-2 py-0.5 rounded-full">Libre</span>
                </div>
              )
            })}

            <LocalSeat userId={userId} leaderUserId={leaderUserId}
              userName={userName} angle={getAngle(MAX_SEATS - 1)} />
            </div>
          </div>
        </div>
      )}

      {/* Panel */}
      {panelContent && (
        <div className="absolute inset-0 z-20 flex flex-col bg-white"
          style={{ animation: 'panelIn 0.30s ease-out' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm shrink-0">
            <h2 className="font-bold text-lg text-gray-800">
              {panelContent === 'pizarra'  ? '🖊️ Pizarra' :
               panelContent === 'cuaderno' ? '📁 Proyectos' :
                                             '📝 Block de notas'}
            </h2>
            <button onClick={closePanel}
              className="text-gray-500 hover:text-gray-800 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl transition">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {panelContent === 'pizarra'  && <Whiteboard roomCode={roomCode} userName={userName} />}
            {panelContent === 'cuaderno' && <Notebook   roomCode={roomCode} userId={userId} />}
            {panelContent === 'notas'    && <QuickNotes roomCode={roomCode} userName={userName} />}
          </div>
        </div>
      )}
    </div>
  )
}
