const en = {
	// Main
	"main.openCalendar": "Open Calendar",

	// View
	"view.calendar": "Calendar",
	"view.report": "Report",

	// Calendar buttons
	"calendar.today": "Today",
	"calendar.month": "Month",
	"calendar.week": "Week",
	"calendar.day": "Day",
	"calendar.list": "List",

	// Task status
	"status.initial": "To Do",
	"status.incomplete": "Incomplete",
	"status.completed": "Done",
	"status.cancelled": "Cancelled",

	// Task type (shared by settings and form)
	"taskType.dailyNote": "Daily Note Task",
	"taskType.project": "Project Task",

	// Settings - Task config
	"settings.taskConfig": "Task Configuration",
	"settings.unnamedTask": "Unnamed Task",
	"settings.taskType": "Task Type",
	"settings.targetFile": "Target File",
	"settings.readFromDailyNotes": "Read from daily notes config",
	"settings.searchFile": "Search and select a file",
	"settings.writeHeading": "Write Heading",
	"settings.selectHeading": "Select Heading",
	"settings.manualInput": "Manual Input",
	"settings.manualHeading": "Manual Heading",
	"settings.enterHeadingName": "Enter heading name",
	"settings.color": "Color",
	"settings.delete": "Delete",
	"settings.addTask": "Add Task",

	// Settings - Calendar preferences
	"settings.calendarPrefs": "Calendar Preferences",
	"settings.initialView": "Initial View",
	"settings.initialViewDesc": "View shown when calendar opens",
	"settings.monthView": "Month",
	"settings.weekView": "Week",
	"settings.dayView": "Day",
	"settings.listView": "List",
	"settings.firstDay": "First Day of Week",
	"settings.firstDayDesc": "Set the first day of each week",
	"settings.sunday": "Sunday",
	"settings.monday": "Monday",
	"settings.tuesday": "Tuesday",
	"settings.wednesday": "Wednesday",
	"settings.thursday": "Thursday",
	"settings.friday": "Friday",
	"settings.saturday": "Saturday",
	"settings.timeFormat24h": "24-Hour Format",
	"settings.timeFormat24hDesc": "Display time in 24-hour format",

	// Settings - Chart colors
	"settings.chartColors": "Chart Colors",
	"settings.resetDesc": "Built-in default colors will be used after reset",
	"settings.resetToDefault": "Reset to Default",
	"settings.barChart": "Bar Chart",

	// Form
	"form.openFile": "Open File",
	"form.delete": "Delete",
	"form.save": "Save",
	"form.create": "Create",
	"form.cancel": "Cancel",
	"form.taskCategory": "Task Category",
	"form.taskName": "Task Name",
	"form.enterTaskName": "Enter task name",
	"form.allDayTask": "All Day Task",
	"form.startDate": "Start Date",
	"form.endDate": "End Date",
	"form.taskDetails": "Task Details",
	"form.taskStatus": "Task Status",
	"form.noFileSelected": "No file selected",
	"form.categoryN": "Category %1",

	// Stats
	"stats.totalTasks": "Total Tasks",
	"stats.completionRate": "Completion Rate",
	"stats.totalDuration": "Total Duration",
	"stats.taskCount": "Task Count",
	"stats.taskDuration": "Time Spent",
	"stats.timeSpent": "Time spent",
};

export default en;
export type TranslationKey = keyof typeof en;
