/**
 * GestureEngine — runs MediaPipe Hands in the browser, classifies gestures,
 * and emits events via a simple EventEmitter pattern.
 *
 * Gestures detected:
 *   - cursor   : only index finger extended (pointing)
 *   - pinch    : thumb + index tips close together
 *   - open     : all 5 fingers extended (open palm)
 *   - fist     : all fingers curled
 *   - swipe_left / swipe_right : fast horizontal palm movement
 *   - victory  : index + middle extended (V sign) → go back
 */

// Types only — no runtime import at module level (avoids SSR issues)
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'

export type GestureName =
  | 'cursor'
  | 'pinch'
  | 'open'
  | 'fist'
  | 'swipe_left'
  | 'swipe_right'
  | 'victory'
  | 'none'

export type GestureEvent = {
  gesture: GestureName
  /** Normalized 0-1 position of the index fingertip (or wrist if no finger) */
  x: number
  y: number
  /** True the first frame a new gesture starts */
  isNew: boolean
  /** Pinch distance normalized 0-1 (only meaningful when gesture === 'pinch') */
  pinchDistance: number
}

type Listener = (e: GestureEvent) => void

class GestureEngine {
  private landmarker: HandLandmarker | null = null
  private video: HTMLVideoElement | null = null
  private animFrame: number | null = null
  private listeners: Set<Listener> = new Set()
  private lastGesture: GestureName = 'none'
  private palmHistory: { x: number; ts: number }[] = []
  private running = false

  async start(videoEl: HTMLVideoElement) {
    if (this.running) return
    this.running = true
    this.video = videoEl

    // Dynamic import keeps @mediapipe/tasks-vision out of the SSR bundle
    const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    )
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    })

    this.loop()
  }

  stop() {
    this.running = false
    if (this.animFrame) cancelAnimationFrame(this.animFrame)
    this.landmarker?.close()
    this.landmarker = null
    this.video = null
  }

  on(fn: Listener) { this.listeners.add(fn) }
  off(fn: Listener) { this.listeners.delete(fn) }

  private emit(e: GestureEvent) {
    this.listeners.forEach(fn => fn(e))
  }

  private loop = () => {
    if (!this.running || !this.landmarker || !this.video) return
    if (this.video.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.video, performance.now())
      this.process(result)
    }
    this.animFrame = requestAnimationFrame(this.loop)
  }

  private process(result: HandLandmarkerResult) {
    if (!result.landmarks || result.landmarks.length === 0) {
      if (this.lastGesture !== 'none') {
        this.lastGesture = 'none'
        this.emit({ gesture: 'none', x: 0, y: 0, isNew: false, pinchDistance: 1 })
      }
      return
    }

    const lm = result.landmarks[0]

    // Key landmarks
    const wrist     = lm[0]
    const thumbTip  = lm[4]
    const indexTip  = lm[8]
    const indexMcp  = lm[5]
    const middleTip = lm[12]
    const middleMcp = lm[9]
    const ringTip   = lm[16]
    const ringMcp   = lm[13]
    const pinkyTip  = lm[20]
    const pinkyMcp  = lm[17]

    // Finger extended = tip is above MCP (lower y value in image coords)
    const indexUp  = indexTip.y  < indexMcp.y  - 0.04
    const middleUp = middleTip.y < middleMcp.y - 0.04
    const ringUp   = ringTip.y   < ringMcp.y   - 0.04
    const pinkyUp  = pinkyTip.y  < pinkyMcp.y  - 0.04

    // Pinch: distance between thumb tip and index tip
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y)
    const isPinch = pinchDist < 0.07

    // Cursor x/y = index tip (mirrored horizontally for natural feel)
    const cx = 1 - indexTip.x
    const cy = indexTip.y

    // Palm x for swipe detection
    const palmX = 1 - wrist.x
    this.palmHistory.push({ x: palmX, ts: Date.now() })
    // Keep last 400ms
    const cutoff = Date.now() - 400
    this.palmHistory = this.palmHistory.filter(p => p.ts > cutoff)

    // Swipe detection
    let swipe: GestureName | null = null
    if (this.palmHistory.length >= 2) {
      const dx = this.palmHistory[this.palmHistory.length - 1].x - this.palmHistory[0].x
      if (Math.abs(dx) > 0.18) swipe = dx > 0 ? 'swipe_right' : 'swipe_left'
    }

    // Classify gesture
    let gesture: GestureName

    if (swipe && (this.lastGesture === 'open' || this.lastGesture === swipe)) {
      gesture = swipe
    } else if (isPinch) {
      gesture = 'pinch'
    } else if (!indexUp && !middleUp && !ringUp && !pinkyUp) {
      gesture = 'fist'
    } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
      gesture = 'victory'
    } else if (indexUp && !middleUp && !ringUp && !pinkyUp) {
      gesture = 'cursor'
    } else if (indexUp && middleUp && ringUp && pinkyUp) {
      gesture = 'open'
    } else {
      gesture = 'cursor'
    }

    const isNew = gesture !== this.lastGesture
    if (isNew) {
      this.lastGesture = gesture
      // Reset palm history on gesture change so swipes don't carry over
      if (gesture !== 'swipe_left' && gesture !== 'swipe_right') {
        this.palmHistory = []
      }
    }

    this.emit({ gesture, x: cx, y: cy, isNew, pinchDistance: pinchDist })
  }
}

// Singleton — only created in the browser (never during SSR/build)
export const gestureEngine: GestureEngine =
  typeof window !== 'undefined'
    ? new GestureEngine()
    : (null as unknown as GestureEngine)
