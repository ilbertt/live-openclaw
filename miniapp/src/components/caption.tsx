export function Caption({ text, visible }: { text: string; visible: boolean }) {
  return (
    <div className={`transcript${visible ? ' visible' : ''}`} aria-live="off">
      {text}
    </div>
  );
}
