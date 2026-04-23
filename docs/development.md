# 开发指南

## 环境要求

- Node.js 18+
- pnpm

## 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 监听并构建
pnpm build        # 生产构建
pnpm lint         # 检查代码
pnpm lint:fix     # 修复可自动修复的问题
pnpm format       # 格式化 src/
```

## 项目结构

```
src/
├── main.ts            # 插件入口与生命周期
├── services/          # 数据读取与事件映射
├── view/              # 日历视图与模态框
├── settings.ts        # 设置面板
├── types/             # 共享类型
├── i18n/              # 国际化
└── utils/             # 工具函数
```

## 移动端调试

```zsh
pnpm dev
obsidian plugin:reload id=obsidian-calendar
obsidian dev:mobile on
```

## 发布产物

Obsidian 加载和发布都依赖这些文件位于插件目录顶层：

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

## 发布流程

### 自动发布（推荐）

```bash
pnpm release <version>
```

自动完成：

- 校验 `package.json`、`manifest.json`、`versions.json` 的版本一致
- 校验 `package.json.name` 和 `manifest.json.id` 一致
- 执行 `pnpm lint`
- 执行 `pnpm build`
- 创建提交 `chore(release): publish <version>`
- 创建 tag 并推送到 `origin`

推送 tag 后，GitHub Actions 会自动创建 Release 并上传产物。

### 手动发布

1. 确认 `manifest.json` 和 `package.json` 的版本一致
2. 本地执行 `pnpm build`，确认能正常构建
3. 提交代码并推送
4. 创建并推送同名 tag：

```bash
git tag 0.0.1
git push origin 0.0.1
```

### Dry run

```bash
pnpm release 0.0.1 --dry-run
```

注意：

- 工作区必须是干净状态，否则会直接退出
- 不会自动改版本号，版本必须提前改好

## 本地测试

将 `main.js`、`manifest.json`、`styles.css` 放到：

```text
<Vault>/.obsidian/plugins/obsidian-calendar/
```

然后在 Obsidian 里重载插件并启用它。
