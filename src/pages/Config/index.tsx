import { Spin, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { readGlobalConfig } from '../../lib/openclaw-commands'
import styles from './index.module.less'

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
      <div className={styles.container}>
        <div className={styles.center}>
          <Spin /> 加载配置中...
        </div>
      </div>
    )
  }

  if (error || !configContent) {
    return (
      <div className={styles.container}>
        <Text type="secondary">配置文件不存在或无法读取</Text>
      </div>
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(configContent)
  } catch {
    return (
      <div className={styles.container}>
        <div className={styles.pathBar}>
          <Text className={styles.path}>~/.openclaw/openclaw.json</Text>
        </div>
        <div className={styles.body}>
          <pre className={styles.code}>{configContent}</pre>
        </div>
      </div>
    )
  }

  const formatted = JSON.stringify(parsed, null, 2)

  return (
    <div className={styles.container}>
      <div className={styles.pathBar}>
        <Text className={styles.path}>~/.openclaw/openclaw.json</Text>
      </div>
      <div className={styles.body}>
        <pre className={styles.code}>{formatted}</pre>
      </div>
    </div>
  )
}
