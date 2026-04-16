'use client'

import { useCallback } from 'react'

import { useLocalParticipant, useParticipants } from '@livekit/components-react'

import { useJarvisHandler } from '@/lib/jarvisBus'
import { resolveToggleState } from '@/lib/jarvisTypes'

export default function RoomVoiceControls() {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant()
  const participants = useParticipants()

  useJarvisHandler(useCallback(async (command) => {
    if (command.action === 'set_camera') {
      await localParticipant.setCameraEnabled(resolveToggleState(isCameraEnabled, command.state))
      return true
    }

    if (command.action === 'set_microphone') {
      await localParticipant.setMicrophoneEnabled(resolveToggleState(isMicrophoneEnabled, command.state))
      return true
    }

    if (command.action === 'mute_participant' && command.participantName) {
      const target = command.participantName.toLowerCase().trim()
      // Match by display name — partial match is enough (e.g. "Juan" matches "Juan Pérez")
      const match = participants.find(p =>
        p.name?.toLowerCase().includes(target) || p.identity?.toLowerCase().includes(target)
      )
      if (match) {
        // Locally silence the participant (we can't mute them server-side, only on our end)
        match.audioTrackPublications.forEach(pub => {
          const track = pub.audioTrack
          if (track?.mediaStreamTrack) {
            track.mediaStreamTrack.enabled = false
          }
        })
      }
      return true
    }

    return false
  }, [isCameraEnabled, isMicrophoneEnabled, localParticipant, participants]))

  return null
}
