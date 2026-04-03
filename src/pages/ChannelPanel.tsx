import { Form, Input, Select, Button, List, Card, Space, Typography, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

const { Text } = Typography

interface Channel {
  id: string
  name: string
  type: string
}

export default function ChannelPanel() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const loadChannels = async () => {
    try {
      const result = await invoke<Channel[]>('get_channels')
      setChannels(result)
    } catch (e) {
      console.error('Failed to load channels:', e)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  const handleAdd = async (values: { name: string; type: string; token?: string; webhookUrl?: string }) => {
    setLoading(true)
    try {
      const newChannel: Channel = {
        id: values.name,
        name: values.name,
        type: values.type,
      }
      setChannels((prev) => [...prev, newChannel])
      form.resetFields()
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div style={{ padding: 16 }}>
      <Card size='small' title='添加渠道' style={{ marginBottom: 16 }}>
        <Form form={form} layout='vertical' onFinish={handleAdd}>
          <Space style={{ width: '100%' }} direction='vertical'>
            <Space>
              <Form.Item name='name' label='名称' rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <Input placeholder='e.g. general' style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name='type' label='类型' rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                <Select placeholder='选择类型' style={{ width: 120 }}>
                  <Select.Option value='discord'>Discord</Select.Option>
                  <Select.Option value='slack'>Slack</Select.Option>
                  <Select.Option value='telegram'>Telegram</Select.Option>
                  <Select.Option value='webhook'>Webhook</Select.Option>
                </Select>
              </Form.Item>
            </Space>
            <Form.Item name='token' label='Token' style={{ marginBottom: 0 }}>
              <Input.Password placeholder='Bot token' />
            </Form.Item>
            <Form.Item name='webhookUrl' label='Webhook URL' style={{ marginBottom: 0 }}>
              <Input placeholder='https://...' />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type='primary' htmlType='submit' icon={<PlusOutlined />} loading={loading}>
                添加
              </Button>
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card size='small' title={`已配置渠道 (${channels.length})`}>
        <List
          dataSource={channels}
          locale={{ emptyText: '暂无渠道' }}
          renderItem={(channel) => (
            <List.Item
              actions={[
                <Popconfirm
                  key='delete'
                  title='确定删除该渠道？'
                  onConfirm={() => handleDelete(channel.id)}
                  okText='确定'
                  cancelText='取消'
                >
                  <Button type='text' danger size='small' icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={<Text>{channel.name}</Text>}
                description={<Text type='secondary'>{channel.type}</Text>}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}