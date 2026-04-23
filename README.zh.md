![calendar](docs/screenshot/hero.jpg)

[EN](README.md) | [中文](README.zh.md)

# iCalendar

[![Support me on Ko-Fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/thatyolanda)

iCalendar 是一个 Obsidian 日历插件，以交互式日历视图展示和管理来自**日记任务**和**项目任务**两个维度的任务。


## 功能特性

### 任务管理

任务来自两个来源，在日历上以不同颜色区分：

- **日记任务** — 兼容 Obsidian 内置日记插件，从每日日记中可配置的标题下读取任务
- **项目任务** — 指向仓库中的任意 Markdown 文件，选择标题即可拉取任务

![configure-dailynote-task](docs/screenshot/1-configure-dailynote-task.gif)
![configure-project-task](docs/screenshot/2-configure-project-task.gif)

### 日历视图

- 月视图、周视图、列表视图自由切换
- 任务按来源和状态以不同颜色显示
- 点击日期快速跳转对应日记
- 拖拽任务调整日程
- 支持设置 12 / 24 小时时间制式

### 任务管理

- 点击日历空白处新建任务，自动写入对应的日记或项目文件
- 点击已有任务打开编辑弹窗——标题、时间、状态、Markdown 描述
- 右键点击任务快速切换状态或删除

![create-task](docs/screenshot/3-create-task.gif)
![handle-task](docs/screenshot/4-handle-task.gif)

### 数据看板

切换到统计视图，直观了解工作情况：

- **统计卡片** — 总任务数、完成率、总耗时，环比变化
- **环形图** — 任务状态分布
- **柱状图** — 每日耗时，支持按周 / 月 切换

![dashboard](docs/screenshot/5-report.gif)

### 移动端深度优化

针对移动端深度优化了布局和交互——紧凑工具栏、触屏友好的编辑、自适应图表。

![mobile](docs/screenshot/6-mobile.png)

### 通过扩展的checkbox区分状态

需要与兼容扩展 CheckBox 的主题配合使用。

![task-status](docs/screenshot/7-task-status.png)

### 国际化

- 支持中文（zh-CN）和英文（en）
- 自动跟随 Obsidian 语言设置

## 安装

### BRAT（推荐）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 添加 Beta Plugin: `https://github.com/that-yolanda/obsidian-calendar`
3. 启用插件

### 手动安装

1. 从 [Releases](https://github.com/that-yolanda/obsidian-calendar/releases) 下载最新版本的 `main.js`、`manifest.json`、`styles.css`
2. 将文件放入 `<Vault>/.obsidian/plugins/icalendar/`
3. 在 Obsidian 设置中启用插件

## 开发

见 [开发指南](docs/development.md)。

## Changelog

见 [CHANGELOG.md](CHANGELOG.md)。

## License

[MIT](LICENSE)
