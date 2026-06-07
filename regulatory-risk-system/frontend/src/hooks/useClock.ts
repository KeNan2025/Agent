/**
 * useClock — live clock for the header. Updates once per second.
 * Returns ISO-style date string + zh-CN time string.
 */
import { useEffect, useState } from 'react';

function fmt(now: Date): { dateStr: string; timeStr: string } {
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
  return { dateStr, timeStr };
}

export function useClock(): { dateStr: string; timeStr: string } {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return fmt(now);
}

export default useClock;
