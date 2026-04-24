const en = {
	// Main
	"main.openCalendar": "Open iCalendar",

	// View
	"view.calendar": "iCalendar",
	"view.report": "Report",

	// Calendar buttons
	"calendar.today": "Today",
	"calendar.month": "Month",
	"calendar.week": "Week",
	"calendar.day": "Day",
	"calendar.list": "List",

	// Task status
	"status.initial": "To do",
	"status.incomplete": "Incomplete",
	"status.completed": "Done",
	"status.cancelled": "Cancelled",

	// Task type (shared by settings and form)
	"taskType.dailyNote": "Daily note task",
	"taskType.project": "Project task",

	// Settings - Task config
	"settings.taskConfig": "Task configuration",
	"settings.unnamedTask": "Unnamed task",
	"settings.taskType": "Task type",
	"settings.targetFile": "Target file",
	"settings.readFromDailyNotes": "Read from daily notes config",
	"settings.searchFile": "Search and select a file",
	"settings.writeHeading": "Write heading",
	"settings.selectHeading": "Select heading",
	"settings.manualInput": "Manual input",
	"settings.manualHeading": "Manual heading",
	"settings.enterHeadingName": "Enter heading name",
	"settings.color": "Color",
	"settings.delete": "Delete",
	"settings.addTask": "Add task",

	// Settings - Calendar preferences
	"settings.calendarPrefs": "Calendar preferences",
	"settings.initialView": "Initial view",
	"settings.initialViewDesc": "View shown when calendar opens",
	"settings.monthView": "Month",
	"settings.weekView": "Week",
	"settings.dayView": "Day",
	"settings.listView": "List",
	"settings.firstDay": "First day of week",
	"settings.firstDayDesc": "Set the first day of each week",
	"settings.sunday": "Sunday",
	"settings.monday": "Monday",
	"settings.tuesday": "Tuesday",
	"settings.wednesday": "Wednesday",
	"settings.thursday": "Thursday",
	"settings.friday": "Friday",
	"settings.saturday": "Saturday",
	"settings.timeFormat24h": "24-hour format",
	"settings.timeFormat24hDesc": "Display time in 24-hour format",

	// Settings - Chart colors
	"settings.chartColors": "Chart colors",
	"settings.resetDesc": "Built-in default colors will be used after reset",
	"settings.resetToDefault": "Reset to default",
	"settings.barChart": "Bar chart",

	// Form
	"form.openFile": "Open file",
	"form.delete": "Delete",
	"form.save": "Save",
	"form.create": "Create",
	"form.cancel": "Cancel",
	"form.taskCategory": "Task category",
	"form.taskName": "Task name",
	"form.enterTaskName": "Enter task name",
	"form.allDayTask": "All day task",
	"form.startDate": "Start date",
	"form.endDate": "End date",
	"form.taskDetails": "Task details",
	"form.taskStatus": "Task status",
	"form.noFileSelected": "No file selected",
	"form.categoryN": "Category %1",

	// Stats
	"stats.totalTasks": "Total tasks",
	"stats.completionRate": "Completion rate",
	"stats.totalDuration": "Total duration",
	"stats.taskCount": "Task count",
	"stats.taskDuration": "Time spent",
	"stats.timeSpent": "Time spent",
};

export default en;
export type TranslationKey = keyof typeof en;
