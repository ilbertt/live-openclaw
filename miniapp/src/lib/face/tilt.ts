import type { TelegramWebApp } from '../telegram.ts';
import type { FridayFace } from './friday-face.ts';
export type TiltEnvironment = {
  doc?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
  screenRef?: { orientation?: { angle: number } };
  motion?: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;
};
// Telegram-native orientation only. Sensor readings remain on this device.
export function attachTiltGaze(
  face: Pick<FridayFace, 'look'>,
  tg: TelegramWebApp | undefined,
  {
    doc = document,
    screenRef = screen,
    motion = matchMedia('(prefers-reduced-motion: reduce)'),
  }: TiltEnvironment = {},
) {
  const sensor = tg?.DeviceOrientation;
  if (!sensor || !tg?.isVersionAtLeast?.('8.0')) return () => {};
  const app = tg;
  const orientation = sensor;
  let running = false,
    destroyed = false,
    x = 0,
    y = 0;
  let origin: { beta: number; gamma: number; angle: number } | null = null;
  const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const clamp = (value: number) => Math.max(-0.75, Math.min(0.75, value));
  function changed() {
    if (!running || doc.hidden || app.isActive === false || motion.matches) return;
    const { beta, gamma } = orientation;
    if (
      typeof beta !== 'number' ||
      typeof gamma !== 'number' ||
      !Number.isFinite(beta) ||
      !Number.isFinite(gamma)
    )
      return;
    const angle = screenRef.orientation?.angle || 0;
    if (!origin || origin.angle !== angle) {
      origin = { beta, gamma, angle };
      x = y = 0;
    }
    const horizontal = angleDelta(gamma, origin.gamma);
    const vertical = angleDelta(beta, origin.beta);
    const radians = (angle * Math.PI) / 180;
    const dx = horizontal * Math.cos(radians) + vertical * Math.sin(radians);
    const dy = vertical * Math.cos(radians) - horizontal * Math.sin(radians);
    // About 30 degrees reaches the gaze limit; suppress tiny hand tremors.
    const targetX = Math.abs(dx) < 0.025 ? 0 : clamp(dx * 1.5);
    const targetY = Math.abs(dy) < 0.025 ? 0 : clamp(dy * 1.5);
    x += (targetX - x) * 0.24;
    y += (targetY - y) * 0.24;
    face.look(x, y, 350);
  }
  function stop() {
    if (running) {
      running = false;
      try {
        orientation.stop();
      } catch {}
    }
    origin = null;
    x = y = 0;
    face.look(0, 0, 150);
  }
  function failed() {
    stop();
  }
  function sync() {
    if (destroyed || doc.hidden || app.isActive === false || motion.matches) {
      stop();
      return;
    }
    if (running) return;
    running = true;
    origin = null;
    try {
      orientation.start({ refresh_rate: 50, need_absolute: false }, (ok) => {
        if (!ok) stop();
      });
    } catch {
      stop();
    }
  }
  tg.onEvent('deviceOrientationChanged', changed);
  tg.onEvent('deviceOrientationFailed', failed);
  tg.onEvent('activated', sync);
  tg.onEvent('deactivated', stop);
  doc.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  sync();
  return () => {
    destroyed = true;
    stop();
    tg.offEvent('deviceOrientationChanged', changed);
    tg.offEvent('deviceOrientationFailed', failed);
    tg.offEvent('activated', sync);
    tg.offEvent('deactivated', stop);
    doc.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
  };
}
