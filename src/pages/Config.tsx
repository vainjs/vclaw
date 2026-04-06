import { Card, Spin, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { readGlobalConfig } from '../lib/openclaw-commands'

const { Text } = Typography

export default function Config() {
  const [configContent, setConfigContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    readGlobalConfig()
      .then(setConfigContent)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin /> 加载配置中...
          </div>
        </Card>
      </div>
    )
  }

  if (error || !configContent) {
    return (
      <div style={{ padding: 16 }}>
        <Card>
          <Text type="secondary">配置文件不存在或无法读取</Text>
        </Card>
      </div>
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(configContent)
  } catch {
    return (
      <div style={{ padding: 16 }}>
        <Card
          title="配置文件"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              ~/.openclaw/openclaw.json
            </Text>
          }
        >
          <pre style={{ fontSize: 12 }}>{configContent}</pre>
        </Card>
      </div>
    )
  }

  const formatted = JSON.stringify(parsed, null, 2)

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Card
        title="配置文件"
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            ~/.openclaw/openclaw.json
          </Text>
        }
      >
        <pre style={{ fontSize: 12, margin: 0 }}>{formatted}</pre>
      </Card>
    </div>
  )
}
