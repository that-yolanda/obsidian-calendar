export const CALENDAR_VIEW_TYPE = "ob-calendar-view";

export const DEFAULT_TASK_LIGHT_COLOR = "#cccccc";
export const DEFAULT_TASK_DARK_COLOR = "#555555";
export const DEFAULT_STATS_BAR_COLOR = "#cccccc";

export const TASK_STATUS_OPTIONS = [
	{
		value: "initial",
		taskChar: " ",
		chartColor: "#f9c344",
	},
	{
		value: "incomplete",
		taskChar: "/",
		chartColor: "#b7b523",
	},
	{
		value: "completed",
		taskChar: "x",
		chartColor: "#302833",
	},
	{
		value: "cancelled",
		taskChar: "-",
		chartColor: "#2d2f48",
	},
] as const;

export type TaskStatus = (typeof TASK_STATUS_OPTIONS)[number]["value"];
export type TaskConfigType = "daily-note" | "file";

export function getTaskChar(status: TaskStatus): string {
	return (
		TASK_STATUS_OPTIONS.find((option) => option.value === status)?.taskChar ??
		" "
	);
}

export function getTaskStatusFromChar(taskChar: string): TaskStatus {
	return (
		TASK_STATUS_OPTIONS.find((option) => option.taskChar === taskChar)?.value ??
		"initial"
	);
}

export interface TaskConfig {
	type: TaskConfigType;
	heading: string;
	targetFile: string;
	lightColor: string;
	darkColor: string;
}

export type StatsChartColors = Record<TaskStatus | "bar", string>;

export const DEFAULT_STATS_CHART_COLORS: StatsChartColors = {
	initial: TASK_STATUS_OPTIONS[0].chartColor,
	incomplete: TASK_STATUS_OPTIONS[1].chartColor,
	completed: TASK_STATUS_OPTIONS[2].chartColor,
	cancelled: TASK_STATUS_OPTIONS[3].chartColor,
	bar: DEFAULT_STATS_BAR_COLOR,
};

export interface ObCalendarSettings {
	taskConfigs: TaskConfig[];
	initialView: string;
	firstDay: number;
	timeFormat24h: boolean;
	statsChartColors: StatsChartColors;
}

export const DEFAULT_SETTINGS: ObCalendarSettings = {
	taskConfigs: [],
	initialView: "timeGridWeek",
	firstDay: 1,
	timeFormat24h: false,
	statsChartColors: DEFAULT_STATS_CHART_COLORS,
};

export interface CalendarEvent {
	id: string;
	title: string;
	date: string;
	endDate?: string;
	startTime?: string;
	endTime?: string;
	status: TaskStatus;
	statusChar: string;
	details?: string;
	sourcePath: string;
	lineNumber: number;
	configIndex: number;
	tags?: string[];
}

export interface TaskFormData {
	title: string;
	details: string;
	allDay: boolean;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	status: TaskStatus;
	configIndex: number;
}

export type StatsPeriod = "week" | "month";

export type TaskStatusCount = Record<TaskStatus, number>;

export interface PeriodSummary {
	totalTasks: number;
	completedRate: number;
	totalMinutes: number;
	prevTotalTasks: number;
	prevCompletedRate: number;
	prevTotalMinutes: number;
	statusDistribution: TaskStatusCount;
	dailyTimeSpent: Array<{ date: string; minutes: number }>;
}
