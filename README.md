# Obsidian Calendar

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/thatyolanda)

一个基于 Obsidian 自定义视图的日历插件项目，源码位于 `src/`，构建产物输出到插件根目录。

## Development

- Node.js 18+
- `pnpm install`
- `pnpm dev`：监听并构建
- `pnpm build`：生产构建
- `pnpm lint`：检查代码
- `pnpm lint:fix`：修复可自动修复的问题
- `pnpm format`：格式化 `src/`

## Project structure

- `src/main.ts`：插件入口与生命周期
- `src/services/`：数据读取与事件映射
- `src/view/`：日历视图与模态框
- `src/settings.ts`：设置面板
- `src/types/`：共享类型

## Release files

Obsidian 加载和发布都依赖这些文件位于插件目录顶层：

- `main.js`
- `manifest.json`
- `styles.css`

## Local testing

将 `main.js`、`manifest.json`、`styles.css` 放到：

```text
<Vault>/.obsidian/plugins/ob-calendar/
```

然后在 Obsidian 里重载插件并启用它。

## License

Baseline is licensed under the [MIT license](LICENSE).
