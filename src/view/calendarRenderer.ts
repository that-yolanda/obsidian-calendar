import {
	Calendar,
	type EventClickArg,
	type EventContentArg,
	type EventDropArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { type App, TFile } from "obsidian";
import { mapEventsToInputs } from "../services/eventMapper";
import {
	type CalendarEvent,
	type ObCalendarSettings,
	TASK_STATUS_CHAR_MAP,
	type TaskStatus,
} from "../types";
import type { TaskDetailData } from "./taskFormModal";

function renderEventContent(arg: EventContentArg): { domNodes: HTMLElement[] } {
	const status = arg.event.extendedProps.status as TaskStatus;
	const statusChar =
		(arg.event.extendedProps.statusChar as string | undefined) ??
		TASK_STATUS_CHAR_MAP[status] ??
		" ";


	const itemEl = document.createElement("div");
	itemEl.className = "ob-calendar-task-row";
	itemEl.setAttribute("data-task", statusChar);
	if (status !== "initial") {
		itemEl.classList.add("is-checked");
	}

	const checkboxEl = document.createElement("input");
	checkboxEl.type = "checkbox";
	checkboxEl.setAttribute("data-task", statusChar);
	checkboxEl.className = "task-list-item-checkbox";
	checkboxEl.disabled = true;
	checkboxEl.tabIndex = -1;
	checkboxEl.checked = status !== "initial";

	const titleEl = document.createElement("span");
	titleEl.className = "ob-calendar-task-title";
	titleEl.textContent = arg.event.title;

	itemEl.append(checkboxEl, titleEl);

	return {
		domNodes: [itemEl],
	};
}

export interface SelectInfo {
	startStr: string;
	endStr: string;
	allDay: boolean;
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
		buttonText: {
			today: "今天",
			month: "月",
			week: "周",
			day: "日",
			list: "列表",
		},
		firstDay: settings.firstDay,
		locale: "zh-cn",
		height: "100%",
		nowIndicator: true,
		editable: true,
		selectable: true,
		dayMaxEvents: true,
		events: mapEventsToInputs(events, settings),
		titleFormat: { year: "numeric", month: "2-digit" },
		eventContent: renderEventContent,
		eventTimeFormat: settings.timeFormat24h
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: { hour: "numeric", minute: "2-digit", hour12: true },
		slotLabelFormat: settings.timeFormat24h
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: { hour: "numeric", minute: "2-digit", hour12: true },

		eventClick(info: EventClickArg) {
			const { sourcePath, lineNumber, status, details, configIndex } =
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
				configIndex: configIndex ?? 0,
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

		datesSet(dateInfo) {
			const titleEl = container.querySelector(
				".fc-toolbar-title",
			) as HTMLElement | null;
			if (!titleEl) return;

			const start = dateInfo.start;
			const end = dateInfo.end;
			const fmt = (d: Date) => {
				const m = String(d.getMonth() + 1).padStart(2, "0");
				const dd = String(d.getDate()).padStart(2, "0");
				return `${m}-${dd}`;
			};
			const yyyy = start.getFullYear();
			const m = String(start.getMonth() + 1).padStart(2, "0");

			let title = "";
			const viewType = dateInfo.view.type;
			if (viewType === "dayGridMonth") {
				title = `${yyyy}-${m}`;
			} else if (viewType === "timeGridDay") {
				title = fmt(start);
			} else {
				const endExclusive = new Date(end);
				endExclusive.setDate(endExclusive.getDate() - 1);
				title = `${fmt(start)} - ${fmt(endExclusive)}`;
			}
			titleEl.textContent = title;
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
