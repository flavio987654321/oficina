'use client'

import { useEffect } from 'react'

import type { JarvisCommand } from './jarvisTypes'

type JarvisHandler = (command: JarvisCommand) => boolean | Promise<boolean>

const handlers = new Set<JarvisHandler>()

export function registerJarvisHandler(handler: JarvisHandler) {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

export function useJarvisHandler(handler: JarvisHandler) {
  useEffect(() => registerJarvisHandler(handler), [handler])
}

export async function dispatchJarvisCommand(command: JarvisCommand) {
  let handled = false

  for (const handler of Array.from(handlers)) {
    const result = await handler(command)
    if (result) handled = true
  }

  return handled
}
