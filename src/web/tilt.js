// Telegram-native orientation only. Sensor readings remain on this device.
export function attachTiltGaze(face, tg, { doc = document, screenRef = screen, motion = matchMedia('(prefers-reduced-motion: reduce)') } = {}) {
  const sensor = tg?.DeviceOrientation;
  if (!sensor || !tg?.isVersionAtLeast?.('8.0')) return () => {};
  let running = false, destroyed = false, origin = null, x = 0, y = 0;
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const clamp = value => Math.max(-.75, Math.min(.75, value));
  function changed() {
    if (!running || doc.hidden || tg.isActive === false || motion.matches) return;
    const { beta, gamma } = sensor;
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    const angle = screenRef.orientation?.angle || 0;
    if (!origin || origin.angle !== angle) { origin = { beta, gamma, angle }; x = y = 0; }
    const horizontal = angleDelta(gamma, origin.gamma);
    const vertical = angleDelta(beta, origin.beta);
    const radians = angle * Math.PI / 180;
    const dx = horizontal * Math.cos(radians) + vertical * Math.sin(radians);
    const dy = vertical * Math.cos(radians) - horizontal * Math.sin(radians);
    // About 30 degrees reaches the gaze limit; suppress tiny hand tremors.
    const targetX = Math.abs(dx) < .025 ? 0 : clamp(dx * 1.5);
    const targetY = Math.abs(dy) < .025 ? 0 : clamp(dy * 1.5);
    x += (targetX - x) * .24; y += (targetY - y) * .24;
    face.look(x, y, 350);
  }
  function stop() {
    if (running) { running = false; try { sensor.stop(); } catch {} }
    origin = null; x = y = 0;
    face.look(0, 0, 150);
  }
  function failed() { stop(); }
  function sync() {
    if (destroyed || doc.hidden || tg.isActive === false || motion.matches) { stop(); return; }
    if (running) return;
    running = true; origin = null;
    try { sensor.start({ refresh_rate: 50, need_absolute: false }, ok => { if (!ok) stop(); }); }
    catch { stop(); }
  }
  tg.onEvent('deviceOrientationChanged', changed);
  tg.onEvent('deviceOrientationFailed', failed);
  tg.onEvent('activated', sync);
  tg.onEvent('deactivated', stop);
  doc.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  sync();
  return () => {
    destroyed = true; stop();
    tg.offEvent('deviceOrientationChanged', changed);
    tg.offEvent('deviceOrientationFailed', failed);
    tg.offEvent('activated', sync);
    tg.offEvent('deactivated', stop);
    doc.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
  };
}
