import type en from "./en";

const zhCN: Partial<typeof en> = {
	// Main
	"main.openCalendar": "打开日历",

	// View
	"view.calendar": "日历",
	"view.report": "报表",

	// Calendar buttons
	"calendar.today": "今天",
	"calendar.month": "月",
	"calendar.week": "周",
	"calendar.day": "日",
	"calendar.list": "列表",

	// Task status
	"status.initial": "未开始",
	"status.incomplete": "未完成",
	"status.completed": "完成",
	"status.cancelled": "取消",

	// Task type
	"taskType.dailyNote": "日记任务",
	"taskType.project": "项目任务",

	// Settings - Task config
	"settings.taskConfig": "任务配置",
	"settings.unnamedTask": "未命名任务",
	"settings.taskType": "任务类型",
	"settings.targetFile": "目标文件",
	"settings.readFromDailyNotes": "从日记配置中读取",
	"settings.searchFile": "搜索并选择文件",
	"settings.writeHeading": "写入标题",
	"settings.selectHeading": "选择标题",
	"settings.manualInput": "手动填写",
	"settings.manualHeading": "手动标题",
	"settings.enterHeadingName": "输入标题名称",
	"settings.color": "颜色",
	"settings.delete": "删除",
	"settings.addTask": "添加任务",

	// Settings - Calendar preferences
	"settings.calendarPrefs": "日历偏好",
	"settings.initialView": "初始视图",
	"settings.initialViewDesc": "打开日历时显示的视图",
	"settings.monthView": "月视图",
	"settings.weekView": "周视图",
	"settings.dayView": "日视图",
	"settings.listView": "列表视图",
	"settings.firstDay": "周起始日",
	"settings.firstDayDesc": "设置每周的第一天",
	"settings.sunday": "周日",
	"settings.monday": "周一",
	"settings.tuesday": "周二",
	"settings.wednesday": "周三",
	"settings.thursday": "周四",
	"settings.friday": "周五",
	"settings.saturday": "周六",
	"settings.timeFormat24h": "24小时制",
	"settings.timeFormat24hDesc": "使用24小时制显示时间",

	// Settings - Chart colors
	"settings.chartColors": "图表配色",
	"settings.resetDesc": "重置后使用内置默认颜色",
	"settings.resetToDefault": "重置为默认",
	"settings.barChart": "柱状图",

	// Form
	"form.openFile": "打开文件",
	"form.delete": "删除",
	"form.save": "保存",
	"form.create": "创建",
	"form.cancel": "取消",
	"form.taskCategory": "任务分类",
	"form.taskName": "任务名称",
	"form.enterTaskName": "请输入任务名称",
	"form.allDayTask": "全天任务",
	"form.startDate": "开始日期",
	"form.endDate": "结束日期",
	"form.taskDetails": "任务详情",
	"form.taskStatus": "任务状态",
	"form.noFileSelected": "未选择文件",
	"form.categoryN": "分类 %1",

	// Stats
	"stats.totalTasks": "总任务",
	"stats.completionRate": "完成率",
	"stats.totalDuration": "总时长",
	"stats.taskCount": "任务数量",
	"stats.taskDuration": "任务耗时",
	"stats.timeSpent": "耗时",
};

export default zhCN;
