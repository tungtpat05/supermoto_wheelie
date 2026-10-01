import { useCrashRestart } from './useCrashRestart';

/** Mounted only during a crash so every crash starts at 3 and leaving cancels it. */
export function CrashCountdown({ onRestart }: { onRestart: () => void }) {
  const secondsRemaining = useCrashRestart(onRestart);

  return (
    <div className="ride-crash-countdown" role="status" aria-live="polite" aria-atomic="true">
      <span className="hud-caption">TỰ KHỞI ĐỘNG LẠI SAU</span>
      <strong>{secondsRemaining}</strong>
    </div>
  );
}
