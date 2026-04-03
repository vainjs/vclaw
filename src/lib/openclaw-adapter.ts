import { invoke } from '@tauri-apps/api/core';

export interface NodeEnv {
  nodeVersion: string;
  nodePath: string;
  npmVersion: string;
}

export async function checkNodeEnv(): Promise<NodeEnv> {
  return invoke<NodeEnv>('check_node_env');
}

export async function startOpenClaw(): Promise<string> {
  return invoke<string>('start_openclaw');
}

export async function stopOpenClaw(): Promise<void> {
  return invoke('stop_openclaw');
}

export interface OpenClawStatus {
  running: boolean;
  gatewayUrl?: string;
}

export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  return invoke<OpenClawStatus>('get_openclaw_status');
}

export async function getOpenClawVersion(): Promise<string> {
  return invoke<string>('get_openclaw_version');
}

// --- Gateway Event Types ---

export interface GatewayEventFrame {
  type: 'event';
  event: string;
  payload?: Record<string, unknown>;
  seq?: number;
}

export interface ChatEventPayload {
  kind: 'delta' | 'final' | 'error' | 'aborted';
  runId?: string;
  sessionKey?: string;
  text?: string;
  error?: string;
}

type EventCallback = (evt: GatewayEventFrame) => void;
type ConnectionCallback = (connected: boolean) => void;

// --- GatewayClient ---

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url = '';
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private eventCallbacks: EventCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private nextId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 750;
  private closed = false;
  private _connected = false;
  private connectNonce: string | null = null;
  private connectSent = false;

  get connected(): boolean {
    return this._connected;
  }

  async connect(url: string): Promise<void> {
    this.url = url;
    this.closed = false;
    await this.doConnect();
  }

  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.flushPending('Client disconnected');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
  }

  async request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const id = String(this.nextId++);
    const frame = { type: 'req', id, method, params: params ?? {} };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter((cb) => cb !== callback);
    };
  }

  // --- Private ---

  private doConnect(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      console.log(`[GatewayClient] Connecting to ${this.url}`);
      const ws = new WebSocket(this.url);
      this.ws = ws;
      this.connectNonce = null;
      this.connectSent = false;

      ws.onopen = () => {
        console.log('[GatewayClient] WebSocket opened, waiting for connect.challenge...');
        this.backoffMs = 750;
      };

      ws.onerror = (e) => {
        console.error('[GatewayClient] WebSocket error:', e);
      };

      ws.onmessage = (event) => {
        this.handleMessage(event.data, resolve, reject);
      };

      ws.onclose = (e) => {
        console.log(`[GatewayClient] WebSocket closed (code=${e.code}, reason=${e.reason || 'none'}, wasConnected=${this._connected})`);
        const wasConnected = this._connected;
        this.setConnected(false);
        if (!this._connected && !this.connectSent) {
          reject(new Error(`Connection closed (${e.code}): ${e.reason || 'server rejected connection'}`));
        }
        this.flushPending('Connection closed');
        this.ws = null;
        if (!this.closed && wasConnected) {
          console.log('[GatewayClient] Scheduling reconnect...');
          this.scheduleReconnect();
        }
      };
    });
  }

  private sendConnect(resolve: (v: unknown) => void, reject: (e: Error) => void): void {
    if (this.connectSent) return;
    this.connectSent = true;
    const nonce = this.connectNonce;
    this.request<Record<string, unknown>>('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'vclaw',
        version: '0.2.0',
        platform: 'desktop',
        mode: 'webchat',
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
      caps: ['tool-events'],
      device: nonce ? {
        id: 'vclaw-device',
        publicKey: '',
        signature: '',
        signedAt: Date.now(),
        nonce,
      } : undefined,
    }).then((hello) => {
      console.log('[GatewayClient] Connect handshake OK', hello);
      this.setConnected(true);
      resolve(hello);
    }).catch((err: Error) => {
      console.error('[GatewayClient] Connect handshake failed:', err);
      reject(err);
    });
  }

  private handleMessage(raw: string, resolve: (v: unknown) => void, reject: (e: Error) => void): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.type === 'res') {
      const id = data.id as string;
      const entry = this.pending.get(id);
      if (entry) {
        this.pending.delete(id);
        if (data.ok === false) {
          const errInfo = data.error as { message?: string; code?: string } | undefined;
          entry.reject(new Error(errInfo?.message ?? 'Request failed'));
        } else {
          entry.resolve(data.payload);
        }
      }
      return;
    }

    if (data.type === 'event') {
      const evt = data as unknown as GatewayEventFrame;
      if (evt.event === 'connect.challenge') {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          console.log('[GatewayClient] Received connect.challenge, sending connect with nonce');
          this.connectNonce = payload.nonce;
          this.sendConnect(resolve, reject);
        }
        return;
      }
      for (const cb of this.eventCallbacks) {
        try {
          cb(evt);
        } catch (err) {
          console.error('[GatewayClient] event callback error:', err);
        }
      }
      return;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log(`[GatewayClient] Reconnecting in ${this.backoffMs}ms (backoff=${this.backoffMs})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closed) return;
      this.doConnect().catch(() => {
        this.backoffMs = Math.min(this.backoffMs * 2, 15000);
        this.scheduleReconnect();
      });
    }, this.backoffMs);
  }

  private flushPending(reason: string): void {
    for (const [, entry] of this.pending) {
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private setConnected(value: boolean): void {
    if (this._connected === value) return;
    this._connected = value;
    for (const cb of this.connectionCallbacks) {
      try {
        cb(value);
      } catch (err) {
        console.error('[GatewayClient] connection callback error:', err);
      }
    }
  }
}

export interface Channel {
  id: string;
  name: string;
  type: string;
}

export async function getChannels(): Promise<Channel[]> {
  return invoke<Channel[]>('get_channels');
}

export interface EnvInfo {
  node: {
    installed: boolean;
    version: string;
    path: string;
    npmVersion: string;
  };
  openclaw: {
    installed: boolean;
    version: string;
    path: string;
  };
}

export async function checkEnv(): Promise<EnvInfo> {
  return invoke<EnvInfo>('check_env');
}

export async function readGlobalConfig(): Promise<string> {
  return invoke<string>('read_global_config');
}


