import { Response } from 'express';
import { SSEStatusUpdatePayload } from '@image-val/shared';
import { logger } from '../infrastructure/logger/logger.js';

interface SSEClient {
  id: string;
  res: Response;
}

export class SSEManager {
  private static instance: SSEManager;
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  private startHeartbeat(): void {
    // Send heartbeat every 15 seconds to prevent NAT/proxy timeouts
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', { timestamp: new Date().toISOString() });
    }, 15000);

    // Unref so it doesn't hold open the process on shutdown
    this.heartbeatInterval.unref();
  }

  public addClient(clientId: string, res: Response): void {
    // Configure SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering if proxied
    });

    res.write(`data: ${JSON.stringify({ event: 'connected', clientId })}\n\n`);

    this.clients.set(clientId, { id: clientId, res });
    logger.debug({ clientId, activeClients: this.clients.size }, 'SSE client connected');

    res.on('close', () => {
      this.removeClient(clientId);
    });
  }

  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.debug({ clientId, remainingClients: this.clients.size }, 'SSE client disconnected');
  }

  public broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch (err) {
        logger.warn({ clientId: id, err }, 'Failed to write SSE event, removing dead client');
        this.clients.delete(id);
      }
    }
  }

  public notifyImageStatus(update: SSEStatusUpdatePayload): void {
    this.broadcast('image:status', update);
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}

export const sseManager = SSEManager.getInstance();
