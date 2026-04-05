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

export type ProcessStatus = 'idle' | 'running' | 'stopped';

export class ProcessManager {
  get status(): ProcessStatus {
    return 'idle';
  }

  async start(): Promise<string> {
    const status = await getOpenClawStatus();
    if (status.running && status.gatewayUrl) {
      return status.gatewayUrl;
    }
    return startOpenClaw();
  }

  async stop(): Promise<void> {
    await stopOpenClaw();
  }

  async restart(): Promise<string> {
    return restartOpenClaw();
  }

  async getStatus(): Promise<OpenClawStatus> {
    return getOpenClawStatus();
  }
}

export async function restartOpenClaw(): Promise<string> {
  return invoke<string>('restart_openclaw');
}

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

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url = '';
  private token = '';
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private eventCallbacks: EventCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 800;
  private closed = false;
  private _connected = false;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  get connected(): boolean {
    return this._connected;
  }

  getUrl(): string {
    return this.url;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async connect(url: string, token?: string): Promise<void> {
    this.url = url;
    if (token) this.token = token;
    this.closed = false;
    return new Promise((resolve, reject) => {
      let resolved = false;
      const onChange = (connected: boolean) => {
        if (resolved) return;
        if (connected) {
          resolved = true;
          unsubscribe();
          resolve();
        } else {
          // Connection dropped before we resolved
          unsubscribe();
          reject(new Error('connection lost'));
        }
      };
      const unsubscribe = this.onConnectionChange(onChange);
      this.doConnect();
      // Timeout after 10s
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          reject(new Error('connection timeout'));
        }
      }, 10000);
    });
  }

  disconnect(): void {
    this.closed = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.flushPending(new Error('gateway client stopped'));
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
    const id = generateId();
    const frame = { type: 'req', id, method, params: params ?? {} };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
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

  private doConnect(): void {
    console.log(`[GatewayClient] Connecting to ${this.url}`);
    const ws = new WebSocket(this.url);
    this.ws = ws;
    this.connectSent = false;

    ws.addEventListener('open', () => this.queueConnect());
    ws.addEventListener('message', (ev) => this.handleMessage(String(ev.data ?? '')));
    ws.addEventListener('close', (e) => {
      const wasConnected = this._connected;
      this.setConnected(false);
      this.flushPending(new Error(`gateway closed (${e.code}): ${e.reason || ''}`));
      this.ws = null;
      if (!this.closed && (wasConnected || this.connectSent)) {
        console.log('[GatewayClient] Scheduling reconnect...');
        this.scheduleReconnect();
      }
    });
    ws.addEventListener('error', () => {});
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15000);
    this.reconnectTimer = setTimeout(() => {
      if (this.closed) return;
      this.doConnect();
    }, delay);
  }

  private queueConnect(): void {
    this.connectSent = false;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      void this.sendConnect();
    }, 750);
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    try {
      const connectParams: Record<string, unknown> = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: '0.2.0',
          platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
          mode: 'ui',
        },
        role: 'operator',
        scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
        caps: ['tool-events'],
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
      };
      if (this.token) {
        connectParams.auth = { token: this.token };
      }
      await this.request<Record<string, unknown>>('connect', connectParams);
      this.backoffMs = 800;
      this.setConnected(true);
    } catch (err) {
      console.error('[GatewayClient] Connect handshake failed:', err);
      this.ws?.close(4008, 'connect failed');
    }
  }

  private handleMessage(raw: string): void {
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
        const nonce = (evt.payload as { nonce?: string })?.nonce;
        if (nonce) {
          // Reset so we can send a new connect
          this.connectSent = false;
          void this.sendConnect();
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
    }
  }

  private flushPending(err: Error): void {
    for (const [, entry] of this.pending) {
      entry.reject(err);
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

export async function getGatewayToken(): Promise<string> {
  return invoke<string>('get_gateway_token');
}
