export const CALENDAR_VIEW_TYPE = "ob-calendar-view";

export type TaskStatus = "initial" | "completed" | "incomplete" | "cancelled";

export interface TaskHeadingConfig {
	heading: string;
	color: string;
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
	details?: string;
	sourcePath: string;
	lineNumber: number;
	headingIndex: number;
	tags?: string[];
}

export interface TaskInfo {
	text: string;
	status: TaskStatus;
	date: string;
	endDate?: string;
	startTime?: string;
	endTime?: string;
	details?: string;
	lineNumber: number;
	headingIndex: number;
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
	headingIndex: number;
}

export interface ObCalendarSettings {
	dailyNoteFolder: string;
	dailyNoteFormat: string;
	taskHeadings: TaskHeadingConfig[];
	initialView: string;
	firstDay: number;
	timeFormat24h: boolean;
}

export const DEFAULT_SETTINGS: ObCalendarSettings = {
	dailyNoteFolder: "",
	dailyNoteFormat: "YYYY-MM-DD",
	taskHeadings: [],
	initialView: "timeGridWeek",
	firstDay: 1,
	timeFormat24h: false,
};
