import type { OpenClawStatus, EnvInfo } from '../../lib/openclaw-types'
import {
  Descriptions,
  Typography,
  Divider,
  message,
  Button,
  Space,
  Card,
} from 'antd'
import {
  PoweroffOutlined,
  PlayCircleOutlined,
  CheckCircleFilled,
  MinusCircleFilled,
  SyncOutlined,
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import {
  getOpenClawStatus,
  getOpenClawVersion,
  checkEnv,
} from '../../lib/openclaw-commands'
import { useGatewayContext } from '../../contexts/GatewayContext'
import styles from './index.module.less'

const { Text } = Typography

export default function Gateway() {
  const ctx = useGatewayContext()
  const [status, setStatus] = useState<OpenClawStatus>({ running: false })
  const [version, setVersion] = useState('')
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [startLoading, setStartLoading] = useState(false)
  const [stopLoading, setStopLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statusData, versionData, envData] = await Promise.all([
        getOpenClawStatus(),
        getOpenClawVersion(),
        checkEnv(),
      ])
      setStatus(statusData)
      setVersion(versionData)
      setEnvInfo(envData)
    } catch (e) {
      console.error('Failed to load data:', e)
    }
  }

  const gatewayConnected = ctx?.gatewayConnected ?? false

  useEffect(() => {
    if (gatewayConnected) {
      setConnecting(false)
    }
  }, [gatewayConnected])

  const handleStart = () => {
    if (!ctx) return
    setStartLoading(true)
    ctx
      .start()
      .then(() => {
        setConnecting(true)
        loadData()
      })
      .catch((e) => {
        message.error('启动失败: ' + String(e))
      })
      .finally(() => {
        setStartLoading(false)
      })
  }

  const handleStop = () => {
    if (!ctx) return
    setStopLoading(true)
    ctx
      .stop()
      .then(() => {
        loadData()
      })
      .catch((e) => {
        message.error('停止失败: ' + String(e))
      })
      .finally(() => {
        setStopLoading(false)
      })
  }

  const envTableDataSource = [
    {
      key: 'node',
      runtime: 'Node.js',
      version: envInfo?.node.installed ? (
        <Text>v{envInfo.node.version}</Text>
      ) : (
        <Text type="secondary">未安装</Text>
      ),
      path: envInfo?.node.installed ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {envInfo.node.path}
        </Text>
      ) : null,
    },
    {
      key: 'openclaw',
      runtime: 'OpenClaw',
      version: envInfo?.openclaw.installed ? (
        <Text>{version || '-'}</Text>
      ) : (
        <Text type="secondary">未安装</Text>
      ),
      path: envInfo?.openclaw.installed ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {envInfo.openclaw.path}
        </Text>
      ) : null,
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Card title="环境信息" style={{ marginBottom: 16 }} loading={!envInfo}>
        <table className={styles.envInfoTable}>
          <thead>
            <tr>
              <th scope="col">运行时</th>
              <th scope="col">版本</th>
              <th scope="col">路径</th>
            </tr>
          </thead>
          <tbody>
            {envTableDataSource.map((item) => (
              <tr key={item.key}>
                <td>{item.runtime}</td>
                <td>{item.version}</td>
                <td>{item.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="网关信息" style={{ marginBottom: 16 }} loading={!envInfo}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Web 控制台地址">
            {status.dashboardUrl ? (
              <Typography.Link
                href={status.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {status.dashboardUrl}
              </Typography.Link>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="网关地址">
            <Text>{status.gatewayUrl || '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Text
              type={
                gatewayConnected
                  ? 'success'
                  : connecting
                    ? 'warning'
                    : 'secondary'
              }
            >
              {connecting ? (
                <>
                  <SyncOutlined spin style={{ marginRight: 6 }} />
                  网关已启动，等待连接...
                </>
              ) : gatewayConnected ? (
                <>
                  <CheckCircleFilled style={{ marginRight: 6 }} />
                  运行中
                </>
              ) : (
                <>
                  <MinusCircleFilled style={{ marginRight: 6 }} />
                  未运行
                </>
              )}
            </Text>
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '24px 0' }} />
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={gatewayConnected}
            loading={startLoading}
            onClick={handleStart}
            aria-label="启动网关"
          >
            启动
          </Button>
          <Button
            danger
            icon={<PoweroffOutlined />}
            disabled={!gatewayConnected}
            loading={stopLoading}
            onClick={handleStop}
            aria-label="停止网关"
          >
            停止
          </Button>
        </Space>
      </Card>
    </div>
  )
}
