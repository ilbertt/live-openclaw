export function waitForIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', changed);
      resolve();
    };
    const changed = () => {
      if (peer.iceGatheringState === 'complete') finish();
    };
    const timer = setTimeout(finish, 2500);
    peer.addEventListener('icegatheringstatechange', changed);
  });
}
export function monitorMicrophone(stream: MediaStream, speech: () => void): () => void {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let speechSince = 0,
    frame = 0;
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const enabled = stream.getAudioTracks().some((track) => track.enabled);
    const level = data.reduce((sum, value) => sum + value, 0) / data.length / 90;
    if (enabled && level > 0.18) {
      speechSince ||= performance.now();
      if (performance.now() - speechSince > 180) speech();
    } else speechSince = 0;
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    source.disconnect();
    void context.close().catch(() => {});
  };
}
