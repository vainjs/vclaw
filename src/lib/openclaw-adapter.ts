import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

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

export interface GatewayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface GatewayClient {
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  onMessage: (callback: (message: GatewayMessage) => void) => UnlistenFn;
  onLog: (callback: (log: string) => void) => Promise<UnlistenFn>;
}

export function createGatewayClient(): GatewayClient {
  let ws: WebSocket | null = null;
  let messageCallbacks: ((message: GatewayMessage) => void)[] = [];
  let unlistenLog: UnlistenFn | null = null;

  listen<string>('openclaw-log', (event) => {
    messageCallbacks.forEach((cb) => cb({
      id: Date.now().toString(),
      role: 'system',
      content: event.payload,
      timestamp: Date.now(),
    }));
  }).then((unlisten) => {
    unlistenLog = unlisten;
  });

  return {
    connect: async (url: string) => {
      return new Promise((resolve, reject) => {
        ws = new WebSocket(url);

        ws.onopen = () => resolve();
        ws.onerror = (e) => reject(e);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            messageCallbacks.forEach((cb) => cb(data));
          } catch {}
        };
      });
    },
    disconnect: () => {
      ws?.close();
      ws = null;
      unlistenLog?.();
    },
    send: (method: string, params?: Record<string, unknown>) => {
      return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not connected'));
          return;
        }

        const id = Date.now().toString();
        const payload = { jsonrpc: '2.0', id, method, params: params || {} };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id === id) {
              resolve(data.result);
            }
          } catch {}
        };

        ws.send(JSON.stringify(payload));
      });
    },
    onMessage: (callback: (message: GatewayMessage) => void) => {
      messageCallbacks.push(callback);
      return () => {
        messageCallbacks = messageCallbacks.filter((cb) => cb !== callback);
      };
    },
    onLog: (callback: (log: string) => void) => {
      return listen<string>('openclaw-log', (event) => {
        callback(event.payload);
      }).then((unlisten) => unlisten);
    },
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SendMessageResult {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: number;
}

interface AgentResponse {
  runId: string;
  status: string;
  result: {
    payloads: Array<{ text: string }>;
  };
}

export async function sendMessage(content: string): Promise<SendMessageResult> {
  const result = await invoke<AgentResponse>('send_message', { message: content });
  return {
    id: result.runId,
    role: 'assistant',
    content: result.result.payloads[0]?.text || '',
    timestamp: Date.now(),
  };
}

export interface Channel {
  id: string;
  name: string;
  type: string;
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
  };
}

export async function checkEnv(): Promise<EnvInfo> {
  return invoke<EnvInfo>('check_env');
}

export interface GlobalConfigInfo {
  exists: boolean;
  path: string;
  availableItems?: Array<{
    name: string;
    label: string;
    size: number;
  }>;
  channels?: string[];
}

export async function checkGlobalConfig(): Promise<GlobalConfigInfo> {
  return invoke<GlobalConfigInfo>('check_global_config');
}

export interface ImportConfigResult {
  success: boolean;
  localPath: string;
  message: string;
  copied?: string[];
  failed?: string[];
}

export async function importGlobalConfig(items: string[]): Promise<ImportConfigResult> {
  return invoke<ImportConfigResult>('import_global_config', { items });
}
