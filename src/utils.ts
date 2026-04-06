export function tryJsonParse(str: string, defaultValue = {}) {
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}
