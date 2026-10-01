export type AudioStats = {
  audioLevel?: number;
  totalAudioEnergy?: number;
  totalSamplesDuration?: number;
  packetsReceived?: number;
  bytesReceived?: number;
};
export function inboundAudio(stats: RTCStatsReport): AudioStats | undefined {
  let result: AudioStats | undefined;
  stats.forEach((value: unknown) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('type' in value) ||
      value.type !== 'inbound-rtp'
    )
      return;
    if (
      !('kind' in value && value.kind === 'audio') &&
      !('mediaType' in value && value.mediaType === 'audio')
    )
      return;
    const field = (key: string): number | undefined => {
      const input = Reflect.get(value, key);
      return typeof input === 'number' && Number.isFinite(input) ? input : undefined;
    };
    result = {
      audioLevel: field('audioLevel'),
      totalAudioEnergy: field('totalAudioEnergy'),
      totalSamplesDuration: field('totalSamplesDuration'),
      packetsReceived: field('packetsReceived'),
      bytesReceived: field('bytesReceived'),
    };
  });
  return result;
}
export class AudioLevel {
  private energy = 0;
  private duration = 0;
  sample(stats: AudioStats | undefined): number {
    if (!stats) return Number.NaN;
    const duration = (stats.totalSamplesDuration ?? 0) - this.duration;
    const level =
      stats.audioLevel ??
      (duration > 0
        ? Math.sqrt(Math.max(0, ((stats.totalAudioEnergy ?? 0) - this.energy) / duration))
        : Number.NaN);
    this.energy = stats.totalAudioEnergy ?? 0;
    this.duration = stats.totalSamplesDuration ?? 0;
    return level;
  }
}
