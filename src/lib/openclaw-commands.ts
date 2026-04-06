import type {
  NodeEnv,
  OpenClawStatus,
  EnvInfo,
  Channel,
} from './openclaw-types'
import { invoke } from '@tauri-apps/api/core'

export async function checkNodeEnv(): Promise<NodeEnv> {
  return invoke<NodeEnv>('check_node_env')
}

export async function startOpenClaw(): Promise<string> {
  return invoke<string>('start_openclaw')
}

export async function stopOpenClaw(): Promise<void> {
  return invoke('stop_openclaw')
}

export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  return invoke<OpenClawStatus>('get_openclaw_status')
}

export async function getOpenClawVersion(): Promise<string> {
  return invoke<string>('get_openclaw_version')
}

export async function checkEnv(): Promise<EnvInfo> {
  return invoke<EnvInfo>('check_env')
}

export async function getChannels(): Promise<Channel[]> {
  return invoke<Channel[]>('get_channels')
}

export async function readGlobalConfig(): Promise<string> {
  return invoke<string>('read_global_config')
}

export async function getGatewayToken(): Promise<string> {
  return invoke<string>('get_gateway_token')
}
