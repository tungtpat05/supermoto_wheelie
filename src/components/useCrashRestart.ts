import { useEffect, useState } from 'react';

const RESTART_DELAY_MS = 3000;

/** One wall-clock countdown per crash; manual restart/unmount cancels both timers. */
export function useCrashRestart(onRestart: () => void) {
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  useEffect(() => {
    const deadline = performance.now() + RESTART_DELAY_MS;
    const interval = window.setInterval(() => {
      setSecondsRemaining(Math.max(1, Math.ceil((deadline - performance.now()) / 1000)));
    }, 100);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      onRestart();
    }, RESTART_DELAY_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onRestart]);

  return secondsRemaining;
}
