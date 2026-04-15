import { useEffect, useRef } from 'react'
import { gestureEngine, type GestureEvent, type GestureName } from './GestureEngine'

/**
 * useGesture — subscribe to gesture events from the global GestureEngine.
 *
 * @param handler  Called every frame with the current gesture event
 * @param gestures Optional filter — only fires for these gesture names
 *
 * Example:
 *   useGesture((e) => {
 *     if (e.gesture === 'pinch') startDrag(e.x, e.y)
 *   }, ['pinch', 'cursor'])
 */
export function useGesture(
  handler: (e: GestureEvent) => void,
  gestures?: GestureName[]
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const fn = (e: GestureEvent) => {
      if (!gestures || gestures.includes(e.gesture)) {
        handlerRef.current(e)
      }
    }
    gestureEngine.on(fn)
    return () => gestureEngine.off(fn)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
