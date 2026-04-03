import { invoke } from '@tauri-apps/api/core'

export async function exportConfig(): Promise<string> {
  return invoke<string>('export_config')
}

export async function importConfig(config: string): Promise<void> {
  return invoke('import_config', { config })
}