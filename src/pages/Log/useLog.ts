import { useState, useEffect, useMemo, useRef } from 'react'
import { useGateway } from '../../contexts/GatewayContext'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  time: string
  level: LogLevel
  subsystem?: string
  message: string
  raw: string
}

const LEVELS = new Set<LogLevel>(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])

function normalizeLevel(value: unknown): LogLevel {
  if (typeof value !== 'string') return 'info'
  const lowered = value.toLowerCase() as LogLevel
  return LEVELS.has(lowered) ? lowered : 'info'
}

function parseMaybeJsonString(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function parseLogLine(line: string): LogEntry {
  if (!line.trim()) return { raw: line, message: line, level: 'info', time: '' }
  try {
    const obj = JSON.parse(line) as Record<string, unknown>
    const meta = (obj._meta as Record<string, unknown>) ?? null
    const time = (typeof obj.time === 'string' ? obj.time : (meta?.date as string)) ?? ''
    const level = normalizeLevel((meta?.logLevelName ?? meta?.level) ?? 'info')

    const contextCandidate = (typeof obj['0'] === 'string' ? obj['0'] : (meta?.name as string)) ?? null
    const contextObj = parseMaybeJsonString(contextCandidate)
    let subsystem: string | null = null
    if (contextObj) {
      subsystem = (contextObj.subsystem as string) ?? (contextObj.module as string) ?? null
    }
    if (!subsystem && contextCandidate && contextCandidate.length < 120) {
      subsystem = contextCandidate
    }

    let message: string | null = null
    if (typeof obj['1'] === 'string') message = obj['1'] as string
    else if (typeof obj['2'] === 'string') message = obj['2'] as string
    else if (!contextObj && typeof obj['0'] === 'string') message = obj['0'] as string
    else if (typeof obj.message === 'string') message = obj.message as string

    return { raw: line, time, level, subsystem: subsystem ?? undefined, message: message ?? line }
  } catch {
    return { raw: line, message: line, level: 'info', time: '' }
  }
}

interface LogsTailResponse {
  file?: string
  cursor?: number
  lines?: unknown
  truncated?: boolean
  reset?: boolean
}

export function useLog() {
  const client = useGateway()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [logFile, setLogFile] = useState<string | null>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [levelFilters, setLevelFilters] = useState<Record<LogLevel, boolean>>({
    trace: true, debug: true, info: true, warn: true, error: true, fatal: true,
  })
  const cursorRef = useRef<number | undefined>(undefined)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const fetchLogs = async (reset = false) => {
    if (!client || !client.connected) return
    try {
      const res = await client.request<LogsTailResponse>('logs.tail', {
        cursor: reset ? undefined : (cursorRef.current ?? undefined),
        limit: 500,
        maxBytes: 1024 * 512,
      })
      const lines = Array.isArray(res.lines) ? res.lines.filter((l): l is string => typeof l === 'string') : []
      const parsed = lines.map(parseLogLine)

      if (reset || res.reset || cursorRef.current == null) {
        setEntries(parsed)
      } else {
        setEntries((prev) => [...prev, ...parsed].slice(-2000))
      }

      if (typeof res.cursor === 'number') {
        cursorRef.current = res.cursor
      }
      if (typeof res.file === 'string') {
        setLogFile(res.file)
      }
    } catch (err) {
      console.error('[useLog] logs.tail error:', err)
    }
  }

  useEffect(() => {
    if (!client) return
    fetchLogs(true)
    pollTimerRef.current = setInterval(() => fetchLogs(false), 2000)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [client])

  const toggleLevel = (level: LogLevel) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  const filtered = useMemo(() =>
    entries.filter((e) => {
      if (!levelFilters[e.level]) return false
      if (filterText) {
        const haystack = [e.message, e.subsystem, e.raw].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(filterText.toLowerCase())) return false
      }
      return true
    }),
    [entries, levelFilters, filterText]
  )

  return { entries, filtered, logFile, autoFollow, setAutoFollow, filterText, setFilterText, levelFilters, toggleLevel }
}
