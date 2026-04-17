'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { dispatchJarvisCommand } from '@/lib/jarvisBus'
import type { JarvisCommand, JarvisContext } from '@/lib/jarvisTypes'

type JarvisAssistantProps = {
  context: JarvisContext
  variant?: 'dark' | 'light'
  autoStart?: boolean
  silent?: boolean
}

type JarvisStatus = 'off' | 'listening' | 'awake' | 'processing' | 'speaking' | 'error'

type SpeechRecognitionAlternative = { transcript: string }
type SpeechRecognitionResultLike  = { isFinal: boolean; 0: SpeechRecognitionAlternative }
type SpeechRecognitionEventLike   = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
type SpeechRecognitionErrorEventLike = { error: string }
type SpeechRecognitionLike = {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

// ── Weather ──────────────────────────────────────────────
type WeatherData = { temp: number; description: string }

function wmoToSpanish(code: number): string {
  if (code === 0)  return 'cielo despejado'
  if (code <= 3)   return 'algo nublado'
  if (code <= 48)  return 'niebla'
  if (code <= 55)  return 'llovizna'
  if (code <= 65)  return 'lluvia'
  if (code <= 77)  return 'nieve'
  if (code <= 82)  return 'chubascos'
  if (code <= 86)  return 'nieve'
  return 'tormenta'
}

async function fetchWeather(): Promise<WeatherData | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res  = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude.toFixed(2)}&longitude=${coords.longitude.toFixed(2)}&current_weather=true`
          )
          const data = await res.json() as { current_weather?: { temperature: number; weathercode: number } }
          const cw   = data.current_weather
          if (!cw) { resolve(null); return }
          resolve({ temp: Math.round(cw.temperature), description: wmoToSpanish(cw.weathercode) })
        } catch { resolve(null) }
      },
      () => resolve(null),
      { timeout: 6000 }
    )
  })
}

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// ── Speech helpers ───────────────────────────────────────
function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function selectSpanishVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.lang === 'es-AR') ??
    voices.find(v => v.lang.startsWith('es-')) ??
    voices.find(v => v.lang.toLowerCase().startsWith('es')) ??
    null
  )
}

function extractCommand(transcript: string) {
  const cleaned = transcript.trim()
  const match   = cleaned.match(/jarvis\b[\s,:-]*(.*)$/i)
  if (match) return { wokeJarvis: true, commandText: match[1]?.trim() ?? '' }
  return        { wokeJarvis: false, commandText: cleaned }
}

// ── Component ────────────────────────────────────────────
export default function JarvisAssistant({
  context, variant = 'dark', autoStart = false, silent = false,
}: JarvisAssistantProps) {
  const [enabled,   setEnabled]   = useState(autoStart)
  const [status,    setStatus]    = useState<JarvisStatus>(autoStart ? 'listening' : 'off')
  const [heardText, setHeardText] = useState('')
  const [reply,     setReply]     = useState('')
  const [errorText, setErrorText] = useState('')

  // These refs never go stale inside recognition callbacks
  const recognitionRef   = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef  = useRef(autoStart)
  const speakingRef      = useRef(false)
  const processingRef    = useRef(false)
  const awakeUntilRef    = useRef(0)
  const contextRef       = useRef(context)
  const enabledRef       = useRef(autoStart)
  useEffect(() => { contextRef.current = context }, [context])
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  // ── speak ────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
      speakingRef.current = false
      if (enabledRef.current) recognitionRef.current?.start()
      return
    }
    window.speechSynthesis.cancel()
    // Stop recognition while TTS plays to avoid feedback loop
    recognitionRef.current?.stop()
    speakingRef.current = true
    setStatus('speaking')
    setReply(text)

    const utterance   = new SpeechSynthesisUtterance(text)
    utterance.lang    = 'es-AR'
    utterance.rate    = 1.1
    utterance.pitch   = 1
    // Delay voice selection to give browser time to load voices
    const voice = selectSpanishVoice()
    if (voice) utterance.voice = voice

    utterance.onend = () => {
      speakingRef.current = false
      if (enabledRef.current && shouldListenRef.current) {
        setStatus('listening')
        try { recognitionRef.current?.start() } catch {}
      } else {
        setStatus('off')
      }
    }
    utterance.onerror = () => {
      speakingRef.current = false
      if (enabledRef.current) {
        setStatus('listening')
        try { recognitionRef.current?.start() } catch {}
      }
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  // ── greet ────────────────────────────────────────────
  const greet = useCallback(async () => {
    setStatus('processing')
    const firstName   = contextRef.current.userName?.split(' ')[0] ?? ''
    const greeting    = getTimeGreeting()
    const base        = `${greeting}${firstName ? `, ${firstName}` : ''}!`
    const weather     = await fetchWeather()
    const weatherText = weather ? ` Afuera hay ${weather.temp} grados y está ${weather.description}.` : ''
    processingRef.current = false
    speak(`${base}${weatherText}`)
  }, [speak])

  // ── handleCommand ────────────────────────────────────
  const handleCommand = useCallback(async (commandText: string) => {
    if (!commandText.trim() || processingRef.current) return
    processingRef.current = true
    setStatus('processing')
    setHeardText(commandText)

    try {
      const res     = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: commandText, context: contextRef.current }),
      })
      const payload = await res.json() as { command?: JarvisCommand }
      const command = payload.command
      if (!res.ok || !command) throw new Error('sin respuesta')

      const handled     = await dispatchJarvisCommand(command)
      const spokenReply = handled
        ? command.spokenReply
        : 'Entendí, pero acá no puedo ejecutar eso.'
      processingRef.current = false
      speak(spokenReply)
    } catch {
      processingRef.current = false
      if (!silent) {
        setErrorText('No pude procesar ese pedido.')
        setStatus('error')
      } else {
        setStatus('listening')
        try { recognitionRef.current?.start() } catch {}
      }
    } finally {
      awakeUntilRef.current = 0
    }
  }, [speak, silent])

  // ── Recognition lifecycle ─────────────────────────────
  useEffect(() => {
    if (!enabled) {
      shouldListenRef.current = false
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
      setStatus('off')
      return
    }

    const RecognitionCtor = getSpeechRecognitionCtor()
    if (!RecognitionCtor) {
      if (!silent) {
        setErrorText('Tu navegador no soporta reconocimiento de voz.')
        setStatus('error')
      }
      setEnabled(false)
      return
    }

    shouldListenRef.current = true

    const recognition = new RecognitionCtor()
    recognition.continuous    = true
    recognition.interimResults = true
    recognition.lang          = 'es-AR'

    recognition.onresult = (event) => {
      // While speaking, ignore everything (avoid feedback loop)
      if (speakingRef.current) return

      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        const t = r[0]?.transcript ?? ''
        if (r.isFinal) finalText  += t
        else           interimText += t
      }

      // Show interim so user sees we're hearing them
      const interimTrimmed = interimText.trim()
      if (interimTrimmed) {
        // Wake-word in interim → instant visual feedback
        if (/jarvis/i.test(interimTrimmed)) {
          setStatus('awake')
          setHeardText(interimTrimmed)
        } else if (status !== 'awake' && status !== 'processing') {
          setHeardText(interimTrimmed)
        }
      }

      if (!finalText.trim()) return
      // While processing, swallow extra commands (don't double-fire)
      if (processingRef.current) return

      const { wokeJarvis, commandText } = extractCommand(finalText)

      if (wokeJarvis) {
        awakeUntilRef.current = Date.now() + 9000
        setStatus('awake')

        const isGreeting   = !commandText || /^(hola|buenas|buenos dias|buenas tardes|hey|que tal|como estas)$/i.test(commandText)
        const isWeatherAsk = /\b(tiempo|clima|temperatura|calor|frio|llueve|lluvia)\b/i.test(commandText)

        if (isGreeting || isWeatherAsk) {
          processingRef.current = true
          void greet()
        } else {
          void handleCommand(commandText)
        }
        return
      }

      // In the 9-second awake window, accept commands without re-saying "Jarvis"
      if (Date.now() < awakeUntilRef.current) {
        void handleCommand(finalText.trim())
      }
    }

    recognition.onerror = (event) => {
      // no-speech and aborted are normal — just let onend restart it
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (speakingRef.current) return
      if (!silent) {
        setErrorText('Hubo un error de audio.')
        setStatus('error')
      }
    }

    // KEY FIX: always restart unless we're speaking or explicitly stopped
    recognition.onend = () => {
      if (!shouldListenRef.current || speakingRef.current) return
      setStatus('listening')
      try { recognition.start() } catch {}
    }

    recognitionRef.current = recognition
    setStatus('listening')
    try { recognition.start() } catch {}

    return () => {
      shouldListenRef.current = false
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try { recognition.stop() } catch {}
      recognitionRef.current = null
    }
  // Only re-run when enabled flips, not on every context/callback change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // ── UI ───────────────────────────────────────────────
  const buttonColors = variant === 'dark'
    ? {
        background: enabled ? 'rgba(96,165,250,0.18)' : 'rgba(255,200,100,0.08)',
        border: enabled ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(201,147,90,0.25)',
        color: enabled ? '#93c5fd' : '#c9935a',
      }
    : {
        background: enabled ? 'rgba(59,130,246,0.10)' : '#ffffff',
        border: enabled ? '1px solid rgba(59,130,246,0.28)' : '1px solid #e4e4e7',
        color: enabled ? '#2563eb' : '#52525b',
      }

  const statusIcon =
    status === 'listening'  ? '🎙' :
    status === 'awake'      ? '👂' :
    status === 'processing' ? '⏳' :
    status === 'speaking'   ? '🔊' :
    status === 'error'      ? '⚠️' : '◉'

  // Orb: full for processing/speaking; compact dot for awake; nothing when just listening silently
  const showFullOrb   = status === 'processing' || status === 'speaking' || (!silent && status === 'error')
  const showAwakeDot  = silent && status === 'awake'
  const showListenDot = silent && status === 'listening' && enabled

  return (
    <>
      <style>{`
        @keyframes jarvisPulse {
          0%   { transform: scale(0.94); box-shadow: 0 0 0 0 rgba(96,165,250,0.35); }
          70%  { transform: scale(1.02); box-shadow: 0 0 0 18px rgba(96,165,250,0); }
          100% { transform: scale(0.96); box-shadow: 0 0 0 0 rgba(96,165,250,0); }
        }
        @keyframes jarvisGlow {
          0%,100% { opacity: 0.75; }
          50%     { opacity: 1; }
        }
        @keyframes jarvisAwakePulse {
          0%,100% { transform: scale(1); opacity: 0.9; }
          50%     { transform: scale(1.35); opacity: 1; }
        }
        @media (max-width: 560px) {
          .jarvis-orb-shell { bottom: 16px !important; gap: 8px !important; }
          .jarvis-orb-core  { width: 58px !important; height: 58px !important; }
          .jarvis-orb-panel { min-width: min(220px, calc(100vw - 28px)) !important; max-width: calc(100vw - 28px) !important; padding: 10px 12px !important; }
        }
      `}</style>

      {/* Toggle button (non-silent mode only) */}
      {!silent && (
        <button
          onClick={() => { setErrorText(''); setReply(''); setHeardText(''); setEnabled(v => !v) }}
          title={enabled ? 'Desactivar Jarvis' : 'Activar Jarvis por voz'}
          style={{
            ...buttonColors,
            borderRadius: 999, padding: '6px 12px', cursor: 'pointer',
            fontSize: 12, fontFamily: 'sans-serif', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.18s ease',
          }}
        >
          <span style={{ fontSize: 13 }}>{statusIcon}</span>
          <span>Jarvis{enabled ? '' : ' (off)'}</span>
        </button>
      )}

      {/* Tiny ambient dot — only in silent mode while listening */}
      {showListenDot && (
        <div style={{
          position: 'fixed', bottom: 14, left: 14, zIndex: 110,
          width: 8, height: 8, borderRadius: '50%',
          background: 'rgba(96,165,250,0.45)',
          boxShadow: '0 0 6px rgba(96,165,250,0.3)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Awake dot — bigger pulse while waiting for command */}
      {showAwakeDot && (
        <div style={{
          position: 'fixed', bottom: 10, left: 10, zIndex: 110,
          width: 14, height: 14, borderRadius: '50%',
          background: '#60a5fa',
          boxShadow: '0 0 12px rgba(96,165,250,0.7)',
          animation: 'jarvisAwakePulse 1s infinite ease-in-out',
          pointerEvents: 'none',
        }} />
      )}

      {/* Full orb — processing / speaking */}
      {showFullOrb && (
        <div className="jarvis-orb-shell" style={{
          position: 'fixed', left: '50%', bottom: 24,
          transform: 'translateX(-50%)', zIndex: 120,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}>
          <div className="jarvis-orb-core" style={{
            width: 70, height: 70, borderRadius: '50%',
            background:
              status === 'error'      ? 'radial-gradient(circle at 30% 30%, #fca5a5, #7f1d1d 70%)' :
              status === 'processing' ? 'radial-gradient(circle at 30% 30%, #fcd34d, #7c3aed 72%)' :
                                        'radial-gradient(circle at 30% 30%, #86efac, #15803d 72%)',
            animation: 'jarvisPulse 1.8s infinite ease-in-out, jarvisGlow 1.6s infinite ease-in-out',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
          }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#eff6ff', opacity: 0.92 }} />
          </div>

          <div className="jarvis-orb-panel" style={{
            minWidth: 240, maxWidth: 420,
            background: 'rgba(8,12,20,0.88)', border: '1px solid rgba(147,197,253,0.22)',
            borderRadius: 18, padding: '12px 16px', boxShadow: '0 18px 48px rgba(0,0,0,0.38)',
            backdropFilter: 'blur(12px)', color: '#e2e8f0', fontFamily: 'sans-serif', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#93c5fd' }}>
              {status === 'processing' ? 'PROCESANDO' : status === 'speaking' ? 'RESPONDIENDO' : 'ERROR'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: '#f8fafc' }}>
              {errorText || reply || heardText || '...'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
