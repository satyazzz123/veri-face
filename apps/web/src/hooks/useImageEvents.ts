import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../services/api';
import { SSEStatusUpdatePayload } from '@image-val/shared';

export function useImageEvents() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<SSEStatusUpdatePayload | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      const url = ApiClient.getEventsUrl();
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener('image:status', (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as SSEStatusUpdatePayload;
          setLastUpdate(payload);
          // Invalidate active image queries to trigger real-time UI refresh
          queryClient.invalidateQueries({ queryKey: ['images'] });
          queryClient.invalidateQueries({ queryKey: ['image', payload.imageId] });
        } catch {
          // Ignore parsing errors
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Attempt reconnect in 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [queryClient]);

  return { isConnected, lastUpdate };
}
