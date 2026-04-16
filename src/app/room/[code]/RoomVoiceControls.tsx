'use client'

import { useCallback } from 'react'

import { useLocalParticipant } from '@livekit/components-react'

import { useJarvisHandler } from '@/lib/jarvisBus'
import { resolveToggleState } from '@/lib/jarvisTypes'

export default function RoomVoiceControls() {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant()

  useJarvisHandler(useCallback(async (command) => {
    if (command.action === 'set_camera') {
      await localParticipant.setCameraEnabled(resolveToggleState(isCameraEnabled, command.state))
      return true
    }

    if (command.action === 'set_microphone') {
      await localParticipant.setMicrophoneEnabled(resolveToggleState(isMicrophoneEnabled, command.state))
      return true
    }

    return false
  }, [isCameraEnabled, isMicrophoneEnabled, localParticipant]))

  return null
}
