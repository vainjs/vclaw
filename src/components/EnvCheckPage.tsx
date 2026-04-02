import { useState, useEffect } from 'react'
import { Button, Card, Space, Typography, Alert, Checkbox, Timeline, Spin } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
import { checkEnv, checkGlobalConfig, importGlobalConfig, GlobalConfigInfo } from '../lib/openclaw-adapter'

const { Title, Text } = Typography

interface EnvCheckPageProps {
  onComplete: () => void
}

type CheckStatus = 'pending' | 'checking' | 'success' | 'error'

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function EnvCheckPage({ onComplete }: EnvCheckPageProps) {
  const [nodeStatus, setNodeStatus] = useState<CheckStatus>('checking')
  const [nodeDesc, setNodeDesc] = useState('')
  const [openclawStatus, setOpenclawStatus] = useState<CheckStatus>('pending')
  const [openclawDesc, setOpenclawDesc] = useState('')
  const [configStatus, setConfigStatus] = useState<CheckStatus>('pending')
  const [configDesc, setConfigDesc] = useState('')
  const [configInfo, setConfigInfo] = useState<GlobalConfigInfo | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  useEffect(() => {
    runChecks()
  }, [])

  const runChecks = async () => {
    setNodeStatus('checking')
    try {
      const env = await checkEnv()
      if (env.node.installed) {
        setNodeStatus('success')
        setNodeDesc(`v${env.node.version}`)
      } else {
        setNodeStatus('error')
        setNodeDesc('未安装')
      }

      setOpenclawStatus('checking')
      if (env.openclaw.installed) {
        setOpenclawStatus('success')
        setOpenclawDesc(`v${env.openclaw.version}`)
      } else {
        setOpenclawStatus('error')
        setOpenclawDesc('未安装')
      }
    } catch (e) {
      setNodeStatus('error')
      setNodeDesc(String(e))
      setOpenclawStatus('error')
      setOpenclawDesc(String(e))
    }

    try {
      setConfigStatus('checking')
      const config = await checkGlobalConfig()
      setConfigInfo(config)
      if (config.exists) {
        const channels = config.channels?.join(', ') || '未知'
        setConfigStatus('success')
        setConfigDesc(`包含渠道: ${channels}`)
        const defaultItems = config.availableItems?.map(i => i.name) || []
        setSelectedItems(defaultItems)
      } else {
        setConfigStatus('success')
        setConfigDesc('未检测到全局配置')
      }
    } catch (e) {
      setConfigStatus('error')
      setConfigDesc(String(e))
    }
  }

  const handleProceed = async () => {
    setImporting(true)
    try {
      if (selectedItems.length > 0) {
        await importGlobalConfig(selectedItems)
      }
    } catch (e) {
      setImportResult('导入失败: ' + String(e))
      setImporting(false)
      return
    }
    setImporting(false)
    onComplete()
  }

  const allSuccess = nodeStatus === 'success' && openclawStatus === 'success'
  const canProceed = allSuccess

  const getTimelineColor = (status: CheckStatus) => {
    if (status === 'checking' || status === 'pending') return 'gray'
    if (status === 'success') return 'green'
    return 'red'
  }

  const getTimelineDot = (status: CheckStatus) => {
    if (status === 'checking') return <LoadingOutlined spin />
    if (status === 'success') return <CheckCircleOutlined />
    return <CloseCircleOutlined />
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', position: 'relative' }}>
      {importing && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <Spin size='large' tip='正在导入配置...' />
        </div>
      )}
      <Card style={{ width: 520 }}>
        <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>环境检测</Title>

        <Timeline
          items={[
            {
              dot: getTimelineDot(nodeStatus),
              children: (
                <div>
                  <Text strong>Node.js</Text>
                  <br />
                  <Text type='secondary' style={{ fontSize: 12 }}>{nodeStatus === 'checking' ? '检测中...' : nodeDesc}</Text>
                </div>
              ),
              color: getTimelineColor(nodeStatus),
            },
            {
              dot: getTimelineDot(openclawStatus),
              children: (
                <div>
                  <Text strong>OpenClaw</Text>
                  <br />
                  <Text type='secondary' style={{ fontSize: 12 }}>{openclawStatus === 'checking' ? '检测中...' : openclawDesc}</Text>
                </div>
              ),
              color: getTimelineColor(openclawStatus),
            },
            {
              dot: getTimelineDot(configStatus),
              children: (
                <div>
                  <Text strong>配置文件</Text>
                  <br />
                  <Text type='secondary' style={{ fontSize: 12 }}>{configStatus === 'checking' ? '检测中...' : configDesc}</Text>
                </div>
              ),
              color: getTimelineColor(configStatus),
            },
          ]}
        />

        {configInfo?.availableItems && configInfo.availableItems.length > 0 && (
          <Card size='small' title='选择要导入的内容' style={{ marginTop: 16 }}>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              <Checkbox.Group
                value={selectedItems}
                onChange={(values) => setSelectedItems(values as string[])}
                style={{ width: '100%' }}
              >
                <Space direction='vertical' style={{ width: '100%' }}>
                  {configInfo.availableItems.map((item) => (
                    <Checkbox key={item.name} value={item.name}>
                      <Space>
                        <Text>{item.label}</Text>
                        <Text type='secondary' style={{ fontSize: 12 }}>({formatSize(item.size)})</Text>
                      </Space>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </div>
          </Card>
        )}

        {importResult && (
          <Alert
            message={importResult.includes('成功') ? '导入成功' : '导入结果'}
            description={importResult}
            type={importResult.includes('失败') ? 'error' : 'success'}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={runChecks} loading={nodeStatus === 'checking' || openclawStatus === 'checking' || configStatus === 'checking'}>
              重新检测
            </Button>
            <Button type='primary' onClick={handleProceed} disabled={!canProceed} loading={importing}>
              {importing ? '导入中...' : '继续'}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}
