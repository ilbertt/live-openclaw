import { useCallback, useEffect, useRef, useState } from 'react';
export function useCaption() {
  const [caption, setCaption] = useState({ text: '', visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string) => {
    clearTimeout(timer.current);
    if (!text) {
      setCaption({ text: '', visible: false });
      return;
    }
    setCaption({ text: text.trim().split(/\s+/).slice(-8).join(' '), visible: true });
    timer.current = setTimeout(() => {
      setCaption((value) => ({ ...value, visible: false }));
      timer.current = setTimeout(() => setCaption({ text: '', visible: false }), 650);
    }, 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { ...caption, show };
}
