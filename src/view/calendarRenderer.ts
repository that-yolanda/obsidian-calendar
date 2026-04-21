import {
	Calendar,
	type EventClickArg,
	type EventDropArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { type App, TFile } from "obsidian";
import { mapEventsToInputs } from "../services/eventMapper";
import type { CalendarEvent, ObCalendarSettings, TaskStatus } from "../types";

export interface SelectInfo {
	startStr: string;
	endStr: string;
	allDay: boolean;
}

export interface TaskDetailData {
	title: string;
	status: TaskStatus;
	allDay: boolean;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	details: string;
	sourcePath: string;
	lineNumber: number;
}

export interface CalendarCallbacks {
	onEventClick: (
		sourcePath: string,
		lineNumber: number,
		eventData: TaskDetailData,
	) => void;
	onSelect: (selectInfo: SelectInfo) => void;
	onEventsChanged: () => void;
	onEventDrop: (info: EventDropArg) => void;
	onEventResize: (info: EventResizeDoneArg) => void;
}

export function renderCalendar(
	container: HTMLElement,
	events: CalendarEvent[],
	settings: ObCalendarSettings,
	_app: App,
	callbacks: CalendarCallbacks,
): Calendar {
	const calendar = new Calendar(container, {
		plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
		initialView: settings.initialView,
		aspectRatio: 1,
		headerToolbar: {
			left: "prev,next today",
			center: "title",
			right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
		},
		firstDay: settings.firstDay,
		locale: "zh-cn",
		height: "100%",
		nowIndicator: true,
		editable: true,
		selectable: true,
		dayMaxEvents: true,
		events: mapEventsToInputs(events, settings),
		eventTimeFormat: settings.timeFormat24h
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: { hour: "numeric", minute: "2-digit", hour12: true },
		slotLabelFormat: settings.timeFormat24h
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: { hour: "numeric", minute: "2-digit", hour12: true },

		eventClick(info: EventClickArg) {
			const { sourcePath, lineNumber, status, details } =
				info.event.extendedProps;
			if (!sourcePath) return;

			const eventData: TaskDetailData = {
				title: info.event.title,
				status: status as TaskStatus,
				allDay: info.event.allDay,
				startDate: info.event.startStr.slice(0, 10),
				startTime: info.event.startStr.includes("T")
					? info.event.startStr.slice(11, 16)
					: "",
				endDate: info.event.endStr?.slice(0, 10) ?? "",
				endTime: info.event.endStr?.includes("T")
					? info.event.endStr.slice(11, 16)
					: "",
				details: details ?? "",
				sourcePath,
				lineNumber,
			};
			callbacks.onEventClick(sourcePath, lineNumber, eventData);
		},

		eventDidMount(info) {
			if (info.event.extendedProps.completed) {
				info.el.classList.add("ob-calendar-task-completed");
			}
		},

		select(info) {
			callbacks.onSelect({
				startStr: info.startStr,
				endStr: info.endStr,
				allDay: info.allDay,
			});
		},

		eventDrop(info: EventDropArg) {
			const { sourcePath } = info.event.extendedProps;
			if (!sourcePath) {
				info.revert();
				return;
			}
			callbacks.onEventDrop(info);
		},

		eventResize(info: EventResizeDoneArg) {
			callbacks.onEventResize(info);
		},
	});

	calendar.render();
	return calendar;
}

export async function openFileAtLine(
	app: App,
	filePath: string,
	lineNumber: number,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file);
	const view = leaf.view;
	if (view && "editor" in view) {
		const editor = view.editor as {
			setCursor: (pos: { line: number; ch: number }) => void;
		};
		editor.setCursor({ line: lineNumber, ch: 0 });
	}
}
