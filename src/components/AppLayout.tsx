import { Layout } from 'antd'
import { Outlet } from 'react-router'
import { useMemo, useState } from 'react'
import Sidebar from './Sidebar'
import { useGateway } from '../hooks/useGateway'
import { GatewayContext } from '../contexts/GatewayContext'

const { Sider, Content } = Layout

const COLLAPSED_KEY = 'sidebar-collapsed'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === 'true'
  )
  const { client, gatewayConnected, version, start, stop } = useGateway()

  const handleCollapse = (val: boolean) => {
    setCollapsed(val)
    localStorage.setItem(COLLAPSED_KEY, String(val))
  }

  const contextValue = useMemo(
    () => ({
      gatewayConnected,
      client,
      start,
      stop,
    }),
    [client, gatewayConnected, start, stop]
  )

  return (
    <GatewayContext.Provider value={contextValue}>
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
          <Sidebar
            collapsed={collapsed}
            onCollapse={handleCollapse}
            gatewayConnected={gatewayConnected}
            version={version}
          />
        </Sider>
        <Content
          style={{
            borderRadius: '10px',
            padding: '6px',
            background: '#f5f5f5',
          }}
        >
          <main
            style={{
              height: '100%',
              borderRadius: '10px',
              background: '#fff',
              overflowY: 'auto',
            }}
          >
            <Outlet />
          </main>
        </Content>
      </Layout>
    </GatewayContext.Provider>
  )
}
