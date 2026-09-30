// A model-issued command arms closing. Transcript content is never classified here.
export function createConversationCloser({ close, pendingChanged = () => {}, now = () => performance.now() }) {
  let pending = null;
  const seen = new Set();
  return {
    request(id) {
      if (typeof id !== 'string' || !id || seen.has(id)) return false;
      seen.add(id);
      if (seen.size > 100) seen.delete(seen.values().next().value);
      pending = { id, started: now(), lastActivity: now(), quietSince: null };
      pendingChanged(true);
      return true;
    },
    cancel() {
      if (!pending) return;
      pending = null;
      pendingChanged(false);
    },
    output() { if (pending) { pending.lastActivity = now(); pending.quietSince = null; } },
    sample(level) {
      if (!pending) return;
      const time = now();
      // On missing telemetry or a long response, stay connected instead of cutting audio.
      if (time - pending.started > 15000) { this.cancel(); return; }
      if (!Number.isFinite(level) || level > .012) { pending.quietSince = null; return; }
      pending.quietSince ??= time;
      if (time - pending.started >= 1800 && time - pending.lastActivity >= 1200 && time - pending.quietSince >= 1000) {
        pending = null;
        pendingChanged(false);
        close();
      }
    },
    get pending() { return pending !== null; },
    reset() { this.cancel(); seen.clear(); },
  };
}
