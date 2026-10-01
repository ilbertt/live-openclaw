// A model-issued command arms closing. Transcript content is never classified here.
export function createConversationCloser({
  close,
  pendingChanged = () => {},
  now = () => performance.now(),
}: {
  close: () => void;
  pendingChanged?: (pending: boolean) => void;
  now?: () => number;
}) {
  let pending: {
    id: string;
    started: number;
    lastActivity: number;
    quietSince: number | null;
  } | null = null;
  const seen = new Set<string>();
  return {
    request(id: unknown) {
      if (typeof id !== 'string' || !id || seen.has(id)) return false;
      seen.add(id);
      if (seen.size > 100) {
        const first = seen.values().next().value;
        if (first) seen.delete(first);
      }
      pending = { id, started: now(), lastActivity: now(), quietSince: null };
      pendingChanged(true);
      return true;
    },
    cancel() {
      if (!pending) return;
      pending = null;
      pendingChanged(false);
    },
    output() {
      if (pending) {
        pending.lastActivity = now();
        pending.quietSince = null;
      }
    },
    sample(level: number) {
      if (!pending) return;
      const time = now();
      // On missing telemetry or a long response, stay connected instead of cutting audio.
      if (time - pending.started > 15000) {
        this.cancel();
        return;
      }
      if (!Number.isFinite(level) || level > 0.012) {
        pending.quietSince = null;
        return;
      }
      pending.quietSince ??= time;
      if (
        time - pending.started >= 1800 &&
        time - pending.lastActivity >= 1200 &&
        time - pending.quietSince >= 1000
      ) {
        pending = null;
        pendingChanged(false);
        close();
      }
    },
    get pending() {
      return pending !== null;
    },
    reset() {
      this.cancel();
      seen.clear();
    },
  };
}
