import { useEffect, useRef, useState } from 'react';
import { createFridayFace } from '../face/friday-face.ts';
import { attachTiltGaze } from '../face/tilt.ts';
import { voiceConfiguration } from '../relay-client.ts';
import { initializeTelegram, telegram } from '../telegram.ts';
import { VoiceController } from '../voice/voice-controller.ts';
import { INITIAL_VOICE_STATE } from '../voice/voice-state.ts';
export function useVoice(caption: (text: string) => void) {
  const faceElement = useRef<HTMLDivElement>(null);
  const audioElement = useRef<HTMLAudioElement>(null);
  const controller = useRef<VoiceController | null>(null);
  const [state, setState] = useState(INITIAL_VOICE_STATE);
  useEffect(() => {
    if (!faceElement.current || !audioElement.current) return;
    initializeTelegram();
    const face = createFridayFace(faceElement.current);
    const audio = audioElement.current;
    let cancelled = false,
      stopTilt = () => {};
    try {
      stopTilt = attachTiltGaze(face, telegram());
    } catch {
      /* Optional sensors must never block voice. */
    }
    void voiceConfiguration()
      .then((config) => {
        if (!cancelled)
          controller.current = new VoiceController(
            config,
            face,
            audio,
            telegram(),
            setState,
            caption,
          );
      })
      .catch((error) => {
        if (!cancelled)
          setState((value) => ({
            ...value,
            error: error instanceof Error ? error.message : 'Could not initialize voice',
          }));
      });
    const end = () => controller.current?.end();
    window.addEventListener('pagehide', end);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', end);
      controller.current?.dispose();
      controller.current = null;
      stopTilt();
      face.destroy();
    };
  }, [caption]);
  return {
    state,
    faceElement,
    audioElement,
    start: () => {
      void controller.current?.start();
    },
    end: () => controller.current?.end(),
    mute: () => controller.current?.toggleMute(),
    enableSound: () => {
      void controller.current?.enableSound();
    },
  };
}
