export const CALENDAR_VIEW_TYPE = "ob-calendar-view";

export type TaskStatus = "initial" | "completed" | "incomplete" | "cancelled";
export type TaskConfigType = "daily-note" | "file";
export const TASK_STATUS_OPTIONS: Array<{
	value: TaskStatus;
	label: string;
	taskChar: string;
}> = [
	{ value: "initial", label: "未开始", taskChar: " " },
	{ value: "incomplete", label: "未完成", taskChar: "/" },
	{ value: "completed", label: "完成", taskChar: "x" },
	{ value: "cancelled", label: "取消", taskChar: "-" },
];

export const TASK_STATUS_CHAR_MAP = Object.fromEntries(
	TASK_STATUS_OPTIONS.map((option) => [option.value, option.taskChar]),
) as Record<TaskStatus, string>;

export const TASK_CHAR_STATUS_MAP = Object.fromEntries(
	TASK_STATUS_OPTIONS.map((option) => [option.taskChar, option.value]),
) as Record<string, TaskStatus>;

export interface TaskConfig {
	type: TaskConfigType;
	heading: string;
	targetFile: string;
	lightColor: string;
	darkColor: string;
}

export interface CalendarEvent {
	id: string;
	title: string;
	date: string;
	endDate?: string;
	startTime?: string;
	endTime?: string;
	allDay: boolean;
	completed: boolean;
	status: TaskStatus;
	statusChar: string;
	details?: string;
	sourcePath: string;
	lineNumber: number;
	configIndex: number;
	tags?: string[];
}

export interface TaskInfo {
	text: string;
	status: TaskStatus;
	statusChar: string;
	date: string;
	endDate?: string;
	startTime?: string;
	endTime?: string;
	details?: string;
	lineNumber: number;
	configIndex: number;
}

export interface TaskFormData {
	name: string;
	details: string;
	allDay: boolean;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	status: TaskStatus;
	configIndex: number;
}

export interface ObCalendarSettings {
	taskConfigs: TaskConfig[];
	initialView: string;
	firstDay: number;
	timeFormat24h: boolean;
}

export const DEFAULT_SETTINGS: ObCalendarSettings = {
	taskConfigs: [],
	initialView: "timeGridWeek",
	firstDay: 1,
	timeFormat24h: false,
};
