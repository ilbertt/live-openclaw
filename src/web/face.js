export { attachTiltGaze } from "./tilt.js";
export { createConversationCloser } from "./conversation-close.js";
import { createFace } from '@bwnd/bbot';

// Cosmetic cues only: no emotion API, model calls, or conversation persistence.
export function expressionFor(text) {
  const value = String(text).toLowerCase();
  if (/\b(non|not|don't|do not|stop)\b.{0,25}\b(laugh|rid|scherz)/i.test(value)) return 'content';
  if (/\b(sad|sorry|hurt|died|morto|triste|dispiace|male|dolore)\b/.test(value)) return 'worried';
  if (/\[(?:laugh\w*|risat\w*)\]?|\b(?:ha){2,}\b|\b(?:ah){2,}\b|😂|🤣/.test(value)) return 'joy';
  if (/\b(wow|incredibile|amazing|fantastico|fantastica)\b/.test(value)) return 'surprised';
  if (/\b(grazie|thanks|thank you|brava|bravo|great|perfetto)\b/.test(value)) return 'happy';
  return null;
}

export function createFridayFace(element) {
  const face = createFace(element, { expression: 'content', mouth: false, blink: true, idle: true });
  let active = false, moodUntil = 0, activityUntil = 0, lastReaction = -Infinity;
  let current = '', energy = 0, lastEnergy = 0, lastDuration = 0, generation = 0, timer;
  function expression(value) {
    if (value !== current) { current = value; face.setExpression(value); element.dataset.expression = value; }
  }
  function event(type, text) {
    if (!active) return;
    const now = performance.now();
    if (type.startsWith('transcript.')) activityUntil = now + 1800;
    const mood = expressionFor(text);
    if (mood && now - lastReaction > 2200) {
      lastReaction = now; moodUntil = now + 2800; expression(mood);
      if (mood === 'joy') face.react('bounce');
      else if (mood === 'happy') face.react('nod');
    }
  }
  async function sample(peer, audio, token) {
    if (token !== generation || !active) return;
    let level = 0;
    try {
      const stats = await peer.getStats();
      if (token !== generation) return;
      const input = [...stats.values()].find(s => s.type === 'inbound-rtp' && (s.kind === 'audio' || s.mediaType === 'audio'));
      if (input) {
        const delta = input.totalSamplesDuration - lastDuration;
        level = Number.isFinite(input.audioLevel) ? input.audioLevel : delta > 0 ? Math.sqrt(Math.max(0, (input.totalAudioEnergy - lastEnergy) / delta)) : 0;
        lastDuration = input.totalSamplesDuration || 0; lastEnergy = input.totalAudioEnergy || 0;
      }
    } catch {}
    if (token !== generation) return;
    // Read-only RTP stats preserve the original Android audio route.
    energy = !audio.paused && !audio.muted && !audio.error ? Math.min(1, level * 5) : 0;
    face.talk(energy);
    const now = performance.now();
    if (now > moodUntil) expression(now < activityUntil ? 'curious' : 'content');
    element.dataset.activity = energy > .03 ? 'speaking' : now < activityUntil ? 'listening' : 'ready';
    timer = setTimeout(() => sample(peer, audio, token), 90);
  }
  function stop() {
    active = false; generation++; clearTimeout(timer); energy = 0; moodUntil = 0; activityUntil = 0;
    face.talk(0); expression('content'); element.dataset.activity = 'idle';
  }
  return {
    event,
    look(x, y, duration) { face.look(x, y, duration); },
    start(peer, audio) { stop(); active = true; lastEnergy = 0; lastDuration = 0; sample(peer, audio, generation); },
    stop,
    destroy() { stop(); face.destroy(); },
  };
}
