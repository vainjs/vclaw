import { useEffect, useRef } from 'react'
import { Input, Switch, Tag, Space, Typography } from 'antd'
import { useLog } from './useLog'
import styles from './index.module.less'

const { Text } = Typography

const LEVEL_COLORS: Record<string, string> = {
  trace: '#909399',
  debug: '#909399',
  info: '#409eff',
  warn: '#e6a23c',
  error: '#f56c6c',
  fatal: '#f56c6c',
}
const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

function formatTime(ts: string): string {
  if (!ts) return ''
  const match = ts.match(/T(\d{2}:\d{2}:\d{2})/)
  return match ? match[1] : ts.slice(0, 8)
}

export default function Log() {
  const { filtered, logFile, autoFollow, setAutoFollow, filterText, setFilterText, levelFilters, toggleLevel } =
    useLog()
  const containerRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)

  useEffect(() => {
    if (autoFollow && containerRef.current && !isAutoScrolling.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [filtered.length, autoFollow])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    isAutoScrolling.current = scrollHeight - scrollTop - clientHeight < 50
  }

  return (
    <div className={styles.container}>
      <Space size={12} wrap className={styles.toolbar}>
        <Input
          placeholder='搜索...'
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Space size={6}>
          <Text type='secondary'>自动跟随</Text>
          <Switch checked={autoFollow} onChange={setAutoFollow} />
        </Space>
        <div className={styles.divider} />
        {LEVELS.map((level) => (
          <Tag
            key={level}
            className={styles.tag}
            style={{
              color: levelFilters[level] ? LEVEL_COLORS[level] : '#9ca3af',
              border: `1px solid ${levelFilters[level] ? LEVEL_COLORS[level] : '#d1d5db'}`,
            }}
            onClick={() => toggleLevel(level)}
          >
            {level}
          </Tag>
        ))}
        {logFile && (
          <Text type='secondary' className={styles.file} title={logFile}>
            {logFile}
          </Text>
        )}
        <Text type='secondary' className={styles.count}>
          {filtered.length} 条
        </Text>
      </Space>

      <div ref={containerRef} onScroll={handleScroll} className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>暂无日志</div>
        ) : (
          filtered.map((entry, i) => (
            <div key={`${entry.raw}-${i}`} className={styles.row}>
              <span className={styles.time}>{formatTime(entry.time)}</span>
              <span className={styles.level} style={{ color: LEVEL_COLORS[entry.level] }}>
                {entry.level}
              </span>
              <span className={styles.subsystem}>{entry.subsystem ? `[${entry.subsystem}]` : ''}</span>
              <span className={styles.message}>{entry.message || entry.raw}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
