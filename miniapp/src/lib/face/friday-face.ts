import type { Expression } from '@bwnd/bbot';
import { createFace } from '@bwnd/bbot';
import { AudioLevel, inboundAudio } from '../voice/audio-stats.ts';

// Cosmetic cues only: no emotion API, model calls, or conversation persistence.
export function expressionFor(text: string): Expression | null {
  const value = String(text).toLowerCase();
  if (/\b(non|not|don't|do not|stop)\b.{0,25}\b(laugh|rid|scherz)/i.test(value)) return 'content';
  if (/\b(sad|sorry|hurt|died|morto|triste|dispiace|male|dolore)\b/.test(value)) return 'worried';
  if (/\[(?:laugh\w*|risat\w*)\]?|\b(?:ha){2,}\b|\b(?:ah){2,}\b|😂|🤣/.test(value)) return 'joy';
  if (/\b(wow|incredibile|amazing|fantastico|fantastica)\b/.test(value)) return 'surprised';
  if (/\b(grazie|thanks|thank you|brava|bravo|great|perfetto)\b/.test(value)) return 'happy';
  return null;
}

export function createFridayFace(element: HTMLElement) {
  const face = createFace(element, {
    expression: 'content',
    mouth: false,
    blink: true,
    idle: true,
  });
  let active = false,
    moodUntil = 0,
    activityUntil = 0,
    lastReaction = -Infinity;
  let current: Expression | null = null,
    energy = 0,
    generation = 0;
  let levels = new AudioLevel();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function expression(value: Expression) {
    if (value !== current) {
      current = value;
      face.setExpression(value);
      element.dataset.expression = value;
    }
  }
  function event(type: string, text: string) {
    if (!active) return;
    const now = performance.now();
    if (type.startsWith('transcript.')) activityUntil = now + 1800;
    const mood = expressionFor(text);
    if (mood && now - lastReaction > 2200) {
      lastReaction = now;
      moodUntil = now + 2800;
      expression(mood);
      if (mood === 'joy') face.react('bounce');
      else if (mood === 'happy') face.react('nod');
    }
  }
  async function sample(peer: RTCPeerConnection, audio: HTMLAudioElement, token: number) {
    if (token !== generation || !active) return;
    let level = 0;
    try {
      const stats = await peer.getStats();
      if (token !== generation) return;
      level = levels.sample(inboundAudio(stats));
      if (!Number.isFinite(level)) level = 0;
    } catch {}
    if (token !== generation) return;
    // Read-only RTP stats preserve the original Android audio route.
    energy = !audio.paused && !audio.muted && !audio.error ? Math.min(1, level * 5) : 0;
    face.talk(energy);
    const now = performance.now();
    if (now > moodUntil) expression(now < activityUntil ? 'curious' : 'content');
    element.dataset.activity =
      energy > 0.03 ? 'speaking' : now < activityUntil ? 'listening' : 'ready';
    timer = setTimeout(() => sample(peer, audio, token), 90);
  }
  function stop() {
    active = false;
    generation++;
    clearTimeout(timer);
    energy = 0;
    moodUntil = 0;
    activityUntil = 0;
    face.talk(0);
    expression('content');
    element.dataset.activity = 'idle';
  }
  return {
    event,
    look(x: number, y: number, duration?: number) {
      face.look(x, y, duration);
    },
    start(peer: RTCPeerConnection, audio: HTMLAudioElement) {
      stop();
      active = true;
      levels = new AudioLevel();
      sample(peer, audio, generation);
    },
    stop,
    destroy() {
      stop();
      face.destroy();
    },
  };
}

export type FridayFace = ReturnType<typeof createFridayFace>;
