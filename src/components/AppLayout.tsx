import { Layout } from 'antd'
import { Outlet } from 'react-router'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Sidebar from './Sidebar'
import {
  startOpenClaw,
  stopOpenClaw,
  getOpenClawStatus,
  getOpenClawVersion,
  GatewayClient,
} from '../lib/openclaw-adapter'
import { GatewayContext } from '../contexts/GatewayContext'

const { Sider, Content } = Layout

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [version, setVersion] = useState('')
  const [gatewayConnected, setGatewayConnected] = useState(false)
  const clientRef = useRef<GatewayClient | null>(null)

  const start = useCallback(async () => {
    if (!clientRef.current) return
    try {
      const currentStatus = await getOpenClawStatus()
      let gatewayUrl = currentStatus.gatewayUrl
      if (!currentStatus.running || !gatewayUrl) {
        gatewayUrl = await startOpenClaw()
      }
      await new Promise((r) => setTimeout(r, 3000))
      await clientRef.current.connect(gatewayUrl)
    } catch (err) {
      console.error('Failed to start gateway:', err)
      throw err
    }
  }, [])

  const stop = useCallback(async () => {
    if (!clientRef.current) return
    try {
      await stopOpenClaw()
    } catch (err) {
      console.error('Failed to stop gateway:', err)
    }
    clientRef.current.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const client = new GatewayClient()
    clientRef.current = client

    client.onConnectionChange((connected) => {
      if (!cancelled) {
        setGatewayConnected(connected)
      }
    })

    getOpenClawVersion().then(setVersion).catch(console.error)

    return () => {
      cancelled = true
      client.disconnect()
      clientRef.current = null
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      client: clientRef.current,
      gatewayConnected,
      start,
      stop,
    }),
    [gatewayConnected, start, stop]
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
            onCollapse={setCollapsed}
            gatewayConnected={gatewayConnected}
            version={version}
          />
        </Sider>
        <Content style={{ borderRadius: '10px', padding: '6px', background: '#f5f5f5' }}>
          <main style={{ height: '100%', borderRadius: '10px', background: '#fff', overflow: 'auto' }}>
            <Outlet />
          </main>
        </Content>
      </Layout>
    </GatewayContext.Provider>
  )
}
