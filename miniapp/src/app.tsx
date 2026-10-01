import { CallControls } from './components/call-controls.tsx';
import { Caption } from './components/caption.tsx';
import { ConnectionStatus } from './components/connection-status.tsx';
import { FridayFace } from './components/friday-face.tsx';
import { useCaption } from './lib/hooks/use-caption.ts';
import { useVoice } from './lib/hooks/use-voice.ts';
export function App() {
  const caption = useCaption();
  const voice = useVoice(caption.show);
  return (
    <div className={`shell${voice.state.active ? ' live' : ''}`}>
      <main>
        <FridayFace faceRef={voice.faceElement} />
        <Caption text={caption.text} visible={caption.visible} />
      </main>
      <footer>
        <ConnectionStatus state={voice.state} />
        <CallControls {...voice} />
      </footer>
      <audio ref={voice.audioElement} autoPlay playsInline>
        <track kind="captions" />
      </audio>
    </div>
  );
}
