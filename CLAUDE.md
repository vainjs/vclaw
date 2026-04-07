# AGENTS.md

VClaw 桌面客户端，Tauri + React + TypeScript，作为 openclaw 的官方 UI。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + antd
- **桌面**: Tauri 2.x
- **进程**: Rust（Tauri Commands），openclaw 全局安装

## 目录结构

```
src/
├── lib/
├── pages/                   # 页面模块
│   └── <Name>/
│       ├── index.tsx        # 页面入口
│       ├── index.module.less # 页面级样式
│       └── use*.ts          # 页面内 hook
├── components/              # 跨页面复用组件
├── contexts/                 # React Context
├── hooks/                    # 跨页面复用 hook
├── routes.tsx
├── App.tsx
└── main.tsx
```

**规范：**

1. 页面入口：`pages/<Name>/index.tsx`，routes 导入 `'./pages/<Name>'` 自动解析
2. 子组件：只在单一页面使用，放置在该页面目录下
3. 页面内 hook：只在单一页面使用，放置在该页面目录下（如 `Log/useLog.ts`）
4. 跨页面复用：hook 和组件放在 `hooks/` 和 `components/`
5. 页面级样式：`index.module.less`（LESS 嵌套），不写全局 CSS
6. 工具方法：尽量使用 lodash-es（filter, find, map 等），不用原生 Array 方法

## 提交规范

Conventional Commits，不使用 Co-Authored-By：

```
<type>(<scope>): <description>

feat(gateway): add auto-reconnect
fix(ui): resolve button alignment
```

类型：feat, fix, docs, style, refactor, perf, test, build, chore

## 工作流程

| 阶段     | 工具                |
| -------- | ------------------- |
| 需求分析 | brainstorming skill |
| 方案规划 | writing-plans skill |
| 提交     | commit skill        |
| 代码规范 | react skill         |
| ui 优化  | ui-ux-pro-max skill |
