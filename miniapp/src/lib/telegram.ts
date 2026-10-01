export type TelegramOrientation = {
  beta: number | null;
  gamma: number | null;
  start(
    options: { refresh_rate: number; need_absolute: boolean },
    callback: (ok: boolean) => void,
  ): void;
  stop(): void;
};
export type TelegramWebApp = {
  initData: string;
  isActive?: boolean;
  DeviceOrientation?: TelegramOrientation;
  isVersionAtLeast?(version: string): boolean;
  onEvent(name: string, callback: () => void): void;
  offEvent(name: string, callback: () => void): void;
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  HapticFeedback?: { impactOccurred(style: 'medium'): void; selectionChanged(): void };
};
declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
export function telegram(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}
export function initializeTelegram(): void {
  const app = telegram();
  app?.ready();
  app?.expand();
  app?.setHeaderColor?.('#140b08');
  app?.setBackgroundColor?.('#140b08');
  app?.setBottomBarColor?.('#140b08');
  try {
    localStorage.removeItem('friday.audioMode');
  } catch {
    /* Storage is optional. */
  }
}
