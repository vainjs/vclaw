# AGENTS.md

VClaw 桌面客户端，Tauri + React + TypeScript，openclaw 的客户端 UI。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + antd + @ant-design/x
- **桌面**: Tauri 2.x
- **进程**: Rust (Tauri Commands)，openclaw 全局安装

## 目录结构

```
src/
├── lib/                    # openclaw 封装（commands, types, utils）
├── hooks/                  # 跨页面复用 hook（useGateway, useWebsocket）
├── components/             # 跨页面复用组件（AppLayout, Sidebar）
├── contexts/               # React Context（GatewayContext）
├── pages/                  # 页面模块
│   ├── <Name>/
│   │   ├── index.tsx
│   │   ├── index.module.less
│   │   └── use*.ts        # 页面内 hook
│   ├── ChatView/          # 聊天（历史、流式、markdown）
│   ├── Gateway/           # 网关启停、状态
│   ├── Log/               # 日志（过滤、auto-follow）
│   └── Config/            # 配置查看
├── routes.tsx
└── App.tsx
```

## 规范

1. 页面入口：`pages/<Name>/index.tsx`
2. 页面级样式：`index.module.less`（LESS），不写全局 CSS
3. 工具方法：尽量使用 lodash-es（filter, find, map）
4. 侧边栏可折叠，状态存 localStorage

## 提交规范

Conventional Commits，不用 Co-Authored-By：

```
<type>(<scope>): <description>

feat(chat): add history persistence
fix(gateway): resolve start timeout
```
