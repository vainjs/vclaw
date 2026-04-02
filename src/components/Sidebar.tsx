import { Menu, Button, Badge, Typography } from 'antd'
import { MessageOutlined, SettingOutlined, TeamOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useEffect } from 'react'
import { getOpenClawStatus, OpenClawStatus } from '../lib/openclaw-adapter'

const { Text } = Typography

type MenuItem = Required<MenuProps>['items'][number]

const items: MenuItem[] = [
  {
    key: 'chat',
    icon: <MessageOutlined />,
    label: '聊天',
  },
  {
    key: 'channels',
    icon: <TeamOutlined />,
    label: '渠道',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '设置',
  },
]

interface SidebarProps {
  collapsed: boolean
  activeKey: string
  onSelect: (key: string) => void
  onCollapse: (collapsed: boolean) => void
  status: OpenClawStatus
  onStatusChange: (status: OpenClawStatus) => void
  version: string
}

export default function Sidebar({
  collapsed,
  activeKey,
  onSelect,
  onCollapse,
  status,
  onStatusChange,
  version,
}: SidebarProps) {
  useEffect(() => {
    const interval = setInterval(() => {
      getOpenClawStatus().then(onStatusChange).catch(console.error)
    }, 5000)

    return () => clearInterval(interval)
  }, [onStatusChange])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <Menu
          style={{ border: 'none', background: '#fff' }}
          onClick={({ key }) => onSelect(key)}
          inlineCollapsed={collapsed}
          selectedKeys={[activeKey]}
          mode='inline'
          items={items}
        />
      </div>

      <div
        style={{
          borderTop: '1px solid #f0f0f0',
          justifyContent: 'space-between',
          padding: '12px 16px',
          alignItems: 'center',
          display: 'flex',
          gap: 8,
        }}
      >
        <Button
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => onCollapse(!collapsed)}
          size='small'
          type='text'
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Text
            style={{ fontSize: 12, width: collapsed ? 0 : 'auto', overflow: 'hidden', whiteSpace: 'nowrap' }}
            type='secondary'
          >
            {collapsed ? '' : version}
          </Text>
          <Badge dot status={status.running ? 'success' : 'error'} />
        </div>
      </div>
    </div>
  )
}
