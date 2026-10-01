import type { Ref } from 'react';
export function FridayFace({ faceRef }: { faceRef: Ref<HTMLDivElement> }) {
  return (
    <div className="stage">
      <div id="fridayFace" ref={faceRef} role="img" aria-label="Friday’s animated face" />
    </div>
  );
}
