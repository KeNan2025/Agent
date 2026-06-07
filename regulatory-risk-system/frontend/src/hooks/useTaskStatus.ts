/**
 * useTaskStatus — poll `/tasks/{task_id}` every `interval` ms until the
 * task completes or fails. Stops automatically on terminal states.
 */
import { useEffect, useState } from 'react';
import { getTaskStatus } from '../api/client';
import type { AsyncTaskRow } from '../types';

export function useTaskStatus(taskId: string | null, intervalMs = 1500) {
  const [task, setTask] = useState<AsyncTaskRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const row = await getTaskStatus(taskId);
        if (cancelled) return;
        setTask(row);
        if (row.status === 'completed' || row.status === 'failed') {
          return; // stop polling
        }
        timer = window.setTimeout(tick, intervalMs);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'task 状态查询失败');
          timer = window.setTimeout(tick, intervalMs * 2);
        }
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [taskId, intervalMs]);

  return { task, error };
}
