import { Layout } from 'antd'
import { Outlet } from 'react-router'
import { useMemo } from 'react'
import Sidebar from './Sidebar'
import { useGateway } from '../hooks/useGateway'
import { GatewayContext } from '../contexts/GatewayContext'

const { Sider, Content } = Layout

export default function AppLayout() {
  const { client, gatewayConnected, version, start, stop } = useGateway()

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
          collapsed={false}
          style={{
            flexDirection: 'column',
            background: '#fff',
            display: 'flex',
          }}
        >
          <Sidebar
            collapsed={false}
            onCollapse={() => {}}
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
