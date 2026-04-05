import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Typography } from 'antd'

const { Text } = Typography

export default function Log() {
  const [logs, setLogs] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unlistenPromise = listen<string>('openclaw-log', (event) => {
      setLogs((prev) => [...prev.slice(-200), event.payload])
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div
      ref={containerRef}
      style={{
        height: 200,
        overflow: 'auto',
        background: '#1e1e1e',
        padding: 8,
        borderRadius: 4,
      }}
    >
      {logs.length === 0 ? (
        <Text style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>等待日志...</Text>
      ) : (
        logs.map((log, i) => (
          <Text
            key={i}
            style={{
              color: log.includes('[error]') ? '#f48771' : log.includes('[warn]') ? '#cca700' : '#d4d4d4',
              fontFamily: 'monospace',
              fontSize: 12,
              display: 'block',
              lineHeight: 1.6,
            }}
          >
            {log}
          </Text>
        ))
      )}
    </div>
  )
}