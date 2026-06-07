/**
 * useScanWebSocket — subscribe to live trace events for a scan_id.
 *
 * Lifecycle:
 *   1. Fetch a one-time ticket from /auth/ws-ticket/{scan_id}
 *   2. Open ws://.../ws/scan/{scan_id}?ticket=...
 *   3. Append every incoming event to local state
 *   4. Close on unmount or scan_complete
 *
 * Returns { events, status, error }.
 */
import { useEffect, useRef, useState } from 'react';
import { getWsTicket } from '../api/client';
import type { WsTraceEvent } from '../types';

type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export function useScanWebSocket(scanId: string | null | undefined) {
  const [events, setEvents] = useState<WsTraceEvent[]>([]);
  const [status, setStatus] = useState<WsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!scanId) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('connecting');
    setError(null);
    setEvents([]);

    (async () => {
      try {
        const { ticket } = await getWsTicket(scanId);
        if (cancelled) return;
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host;
        const url = `${proto}://${host}/ws/scan/${scanId}?ticket=${encodeURIComponent(ticket)}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) setStatus('open');
        };
        ws.onmessage = (msg) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(msg.data) as WsTraceEvent;
            setEvents((prev) => [...prev, data]);
            if (data.type === 'scan_complete') {
              ws.close();
            }
          } catch {
            /* ignore malformed */
          }
        };
        ws.onerror = () => {
          if (!cancelled) {
            setStatus('error');
            setError('WebSocket 连接出错');
          }
        };
        ws.onclose = () => {
          if (!cancelled) setStatus('closed');
        };
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error');
          setError(e?.message ?? '获取 WS Ticket 失败');
        }
      }
    })();

    return () => {
      cancelled = true;
      const ws = wsRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try { ws.close(); } catch { /* ignore */ }
      }
      wsRef.current = null;
    };
  }, [scanId]);

  return { events, status, error };
}
