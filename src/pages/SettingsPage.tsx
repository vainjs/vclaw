import { Card, Descriptions, Button, Space, Typography, Divider, message } from 'antd'
import { PoweroffOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { getOpenClawStatus, getOpenClawVersion, checkEnv, OpenClawStatus, EnvInfo } from '../lib/openclaw-adapter'
import { useGatewayContext } from '../contexts/GatewayContext'

const { Text } = Typography

export default function SettingsPage() {
  const ctx = useGatewayContext()
  const [status, setStatus] = useState<OpenClawStatus>({ running: false })
  const [version, setVersion] = useState('')
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [startLoading, setStartLoading] = useState(false)
  const [stopLoading, setStopLoading] = useState(false)

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

  return (
    <div style={{ padding: 16 }}>
      <Card title='环境信息' style={{ marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', color: '#999', fontWeight: 'normal' }}>运行时</th>
              <th style={{ textAlign: 'left', padding: '8px 0', color: '#999', fontWeight: 'normal' }}>版本</th>
              <th style={{ textAlign: 'left', padding: '8px 0', color: '#999', fontWeight: 'normal' }}>路径</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 0' }}>Node.js</td>
              <td style={{ padding: '10px 0' }}>
                {envInfo?.node.installed ? (
                  <Text>v{envInfo.node.version}</Text>
                ) : (
                  <Text type='secondary'>未安装</Text>
                )}
              </td>
              <td style={{ padding: '10px 0' }}>
                {envInfo?.node.installed ? (
                  <Text type='secondary' style={{ fontSize: 12 }}>{envInfo.node.path}</Text>
                ) : null}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0' }}>OpenClaw</td>
              <td style={{ padding: '10px 0' }}>
                {envInfo?.openclaw.installed ? (
                  <Text>{version || '-'}</Text>
                ) : (
                  <Text type='secondary'>未安装</Text>
                )}
              </td>
              <td style={{ padding: '10px 0' }}>
                {envInfo?.openclaw.installed ? (
                  <Text type='secondary' style={{ fontSize: 12 }}>{envInfo.openclaw.path}</Text>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title='OpenClaw 进程' style={{ marginTop: 16 }}>
        <Descriptions column={1} size='small'>
          <Descriptions.Item label='状态'>
            <Text type={gatewayConnected ? 'success' : 'secondary'}>
              {gatewayConnected ? '运行中' : '未运行'}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label='Gateway URL'>
            <Text code>{status.gatewayUrl || '-'}</Text>
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '12px 0' }} />
        <Space>
          <Button type='primary' icon={<PlayCircleOutlined />} disabled={gatewayConnected} loading={startLoading} onClick={async () => {
            setStartLoading(true)
            try {
              await ctx?.start()
            } catch (e) {
              message.error('启动失败: ' + String(e))
            } finally {
              setStartLoading(false)
            }
            loadData()
          }}>
            启动
          </Button>
          <Button danger icon={<PoweroffOutlined />} disabled={!gatewayConnected} loading={stopLoading} onClick={async () => {
            setStopLoading(true)
            try {
              await ctx?.stop()
            } catch (e) {
              message.error('停止失败: ' + String(e))
            } finally {
              setStopLoading(false)
            }
            loadData()
          }}>
            停止
          </Button>
        </Space>
      </Card>
    </div>
  )
}