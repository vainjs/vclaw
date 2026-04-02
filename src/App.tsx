import { Layout } from 'antd'
import { useState, useEffect } from 'react'
import ChatView from './components/ChatView'
import Sidebar from './components/Sidebar'
import EnvCheckPage from './components/EnvCheckPage'
import { getOpenClawStatus, getOpenClawVersion, OpenClawStatus } from './lib/openclaw-adapter'
import './App.css'

const { Sider, Content } = Layout

export default function App() {
  const [envReady, setEnvReady] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [activeView, setActiveView] = useState('chat')
  const [status, setStatus] = useState<OpenClawStatus>({ running: false })
  const [version, setVersion] = useState('')

  useEffect(() => {
    getOpenClawVersion().then(setVersion).catch(console.error)
    getOpenClawStatus().then(setStatus).catch(console.error)
  }, [])

  if (!envReady) {
    return <EnvCheckPage onComplete={() => setEnvReady(true)} />
  }

  return (
    <Layout style={{ height: '100%', background: '#fff' }}>
      <Sider
        width={180}
        collapsedWidth={64}
        collapsed={collapsed}
        style={{
          flexDirection: 'column',
          background: '#fff',
          display: 'flex',
        }}
      >
        <Sidebar collapsed={collapsed} activeKey={activeView} onSelect={setActiveView} onCollapse={setCollapsed} status={status} onStatusChange={setStatus} version={version} />
      </Sider>
      <Content style={{ borderRadius: '10px', padding: '6px', background: '#f5f5f5' }}>
        <main style={{ height: '100%', borderRadius: '10px', background: '#fff' }}>
          {activeView === 'chat' && <ChatView />}
          {activeView === 'channels' && <div style={{ padding: 24 }}>渠道管理 - 待实现</div>}
          {activeView === 'settings' && <div style={{ padding: 24 }}>设置 - 待实现</div>}
        </main>
      </Content>
    </Layout>
  )
}
