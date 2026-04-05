import { Menu, Button, Badge, Typography } from 'antd'
import {
  MessageOutlined,
  LaptopOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { NavLink, useLocation } from 'react-router'

const { Text } = Typography

const items = [
  {
    key: 'chat',
    icon: <MessageOutlined />,
    label: <NavLink to='/chat'>聊天</NavLink>,
  },
  {
    key: 'channels',
    icon: <TeamOutlined />,
    label: <NavLink to='/channels'>渠道</NavLink>,
  },
  {
    key: 'logs',
    icon: <FileTextOutlined />,
    label: <NavLink to='/logs'>日志</NavLink>,
  },
  {
    key: 'gateway',
    icon: <LaptopOutlined />,
    label: <NavLink to='/gateway'>网关</NavLink>,
  },
  {
    key: 'config',
    icon: <ToolOutlined />,
    label: <NavLink to='/config'>配置</NavLink>,
  },
]

interface SidebarProps {
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
  gatewayConnected: boolean
  version: string
}

export default function Sidebar({ collapsed, onCollapse, gatewayConnected, version }: SidebarProps) {
  const location = useLocation()

  const selectedKey = location.pathname.split('/')[1] || 'chat'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <Menu
          style={{ border: 'none', background: '#fff' }}
          inlineCollapsed={collapsed}
          mode='inline'
          selectedKeys={[selectedKey]}
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
          <Badge dot status={gatewayConnected ? 'success' : 'error'} />
        </div>
      </div>
    </div>
  )
}
