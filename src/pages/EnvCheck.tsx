import { useState, useEffect } from 'react'
import { Button, Card, Space, Typography, Timeline } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { checkEnv } from '../lib/openclaw-commands'

const { Title, Text } = Typography

type CheckStatus = 'pending' | 'checking' | 'success' | 'error'

export default function EnvCheck() {
  const navigate = useNavigate()
  const [nodeStatus, setNodeStatus] = useState<CheckStatus>('checking')
  const [nodeDesc, setNodeDesc] = useState('')
  const [openclawStatus, setOpenclawStatus] = useState<CheckStatus>('pending')
  const [openclawDesc, setOpenclawDesc] = useState('')

  useEffect(() => {
    runChecks()
  }, [])

  const runChecks = async () => {
    setNodeStatus('checking')
    setOpenclawStatus('checking')
    try {
      const env = await checkEnv()
      if (env.node.installed) {
        setNodeStatus('success')
        setNodeDesc(`v${env.node.version}`)
      } else {
        setNodeStatus('error')
        setNodeDesc('未安装')
      }
      if (env.openclaw.installed) {
        setOpenclawStatus('success')
        setOpenclawDesc(env.openclaw.version)
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
  }

  const canProceed = nodeStatus === 'success' && openclawStatus === 'success'

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
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 520 }}>
        <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>
          环境检测
        </Title>

        <Timeline
          items={[
            {
              dot: getTimelineDot(nodeStatus),
              children: (
                <div>
                  <Text strong>Node.js</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {nodeStatus === 'checking' ? '检测中...' : nodeDesc}
                  </Text>
                  {nodeStatus === 'error' && (
                    <>
                      <br />
                      <Text type="danger" style={{ fontSize: 12 }}>
                        请安装 Node.js LTS：
                        <a
                          href="https://nodejs.org/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          https://nodejs.org/
                        </a>
                      </Text>
                    </>
                  )}
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
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {openclawStatus === 'checking' ? '检测中...' : openclawDesc}
                  </Text>
                  {openclawStatus === 'error' && (
                    <>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        请运行以下命令安装：
                      </Text>
                      <br />
                      <Text code style={{ fontSize: 11 }}>
                        npm install -g openclaw
                      </Text>
                      <br />
                      <Text code style={{ fontSize: 11 }}>
                        或 pnpm add -g openclaw
                      </Text>
                    </>
                  )}
                </div>
              ),
              color: getTimelineColor(openclawStatus),
            },
          ]}
        />

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space direction="vertical">
            <Space>
              <Button onClick={runChecks}>重新检测</Button>
              <Button
                type="primary"
                disabled={!canProceed}
                onClick={() => navigate('/chat')}
              >
                进入应用
              </Button>
            </Space>
            {!canProceed && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                请先完成上述安装步骤
              </Text>
            )}
          </Space>
        </div>
      </Card>
    </div>
  )
}
