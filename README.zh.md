![calendar](docs/screenshot/hero.jpg)

[EN](README.md) | [中文](README.zh.md)

# Obsidian Calendar

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/thatyolanda)

一个基于 FullCalendar 的 Obsidian 日历插件，将日记中的任务以日历视图展示和管理。

## 功能特性

### 日历视图

<!-- 截图建议：日历月视图，展示有任务的日期和任务色块 -->

- 月视图、周视图、列表视图自由切换
- 自动读取日记中的任务，按状态以不同颜色显示在日历上
- 点击日期快速跳转对应日记
- 支持设置 12 / 24 小时时间制式

### 任务管理

<!-- 截图建议：新建/编辑任务的 Modal 弹窗 -->

- 点击日历空白处新建任务，自动写入对应日期的日记
- 点击已有任务打开编辑弹窗，修改后同步回日记
- 支持设置任务的开始时间、结束时间、状态、描述
- 内置 Markdown 编辑器用于任务描述，支持实时预览

### 右键操作

<!-- 截图建议：右键点击任务弹出的状态切换菜单 -->

- 右键点击任务快速切换状态（待办 / 已完成 / 进行中 / 已取消）
- 右键删除任务

### 数据看板

<!-- 截图建议：Stats Dashboard 页面，展示统计卡片 + 环形图 + 柱状图 -->

- 统计卡片：总任务数、完成率、总耗时，含环比变化
- 任务状态分布环形图
- 每日耗时柱状图，支持按周 / 月 / 年查看

### 移动端适配

<!-- 截图建议：手机端日历视图的截图 -->

- 针对手机屏幕优化工具栏和布局
- 任务编辑弹窗适配移动端交互

### 国际化

- 支持中文（zh-CN）和英文（en）
- 自动跟随 Obsidian 语言设置

## 安装

### BRAT（推荐）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 添加 Beta Plugin: `that-yolanda/obsidian-calendar`
3. 启用插件

### 手动安装

1. 从 [Releases](https://github.com/that-yolanda/obsidian-calendar/releases) 下载最新版本的 `main.js`、`manifest.json`、`styles.css`
2. 将文件放入 `<Vault>/.obsidian/plugins/obsidian-calendar/`
3. 在 Obsidian 设置中启用插件

## 截图清单

以下是建议补充的截图（替换为实际截图后删除此节）：

| 截图 | 说明 | 建议文件名 |
|------|------|-----------|
| 日历月视图 | 展示有任务的日期和色块 | `docs/screenshot/calendar.png` |
| 任务创建/编辑弹窗 | 新建或编辑任务的 Modal | `docs/screenshot/task-modal.png` |
| 右键菜单 | 右键切换任务状态 | `docs/screenshot/context-menu.png` |
| 数据看板 | 统计卡片 + 图表 | `docs/screenshot/dashboard.png` |
| 设置面板 | 插件设置页面 | `docs/screenshot/settings.png` |
| 移动端视图 | 手机端日历效果 | `docs/screenshot/mobile.png` |

## 开发

见 [开发指南](docs/development.md)。

## Changelog

见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE)
