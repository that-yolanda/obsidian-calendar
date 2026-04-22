import type { Calendar, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import type ObCalendarPlugin from "../main";
import { mapEventsToInputs } from "../services/eventMapper";
import { CALENDAR_VIEW_TYPE } from "../types";
import {
	type CalendarCallbacks,
	openFileAtLine,
	renderCalendar,
	type SelectInfo,
} from "./calendarRenderer";
import { type TaskDetailData, TaskFormModal } from "./taskFormModal";

export class CalendarView extends ItemView {
	private plugin: ObCalendarPlugin;
	private calendar: Calendar | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ObCalendarPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "日历";
	}

	getIcon(): string {
		return "calendar-glyph";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add("ob-calendar-wrapper");

		const events = await this.plugin.dailyNoteService.scanDailyNotes();

		const callbacks: CalendarCallbacks = {
			onEventClick: (_sourcePath, _lineNumber, eventData) => {
				this.handleEventClick(eventData);
			},
			onSelect: (selectInfo) => {
				this.handleDateSelect(selectInfo);
			},
			onEventsChanged: () => {
				this.refreshCalendar();
			},
			onEventDrop: (info) => {
				this.handleEventDrop(info);
			},
			onEventResize: (info) => {
				this.handleEventResize(info);
			},
		};

		this.calendar = renderCalendar(
			container,
			events,
			this.plugin.settings,
			this.app,
			callbacks,
		);

		this.plugin.dailyNoteService.onUpdate(() => {
			this.refreshCalendar();
		});
	}

	async onClose(): Promise<void> {
		this.calendar?.destroy();
		this.calendar = null;
	}

	onResize(): void {
		this.calendar?.updateSize();
	}

	public refreshCalendar(): void {
		if (!this.calendar) return;

		const events = this.plugin.dailyNoteService.getCachedEvents();
		const inputs = mapEventsToInputs(events, this.plugin.settings);

		this.calendar.removeAllEvents();
		for (const input of inputs) {
			this.calendar.addEvent(input);
		}
		this.calendar.updateSize();
	}

	private handleEventClick(eventData: TaskDetailData): void {
		new TaskFormModal(this.app, {
			mode: "edit",
			taskConfigs: this.plugin.settings.taskConfigs,
			initialData: eventData,
			onSave: async (sourcePath, lineNumber, formData) => {
				await this.plugin.dailyNoteService.updateTask(
					sourcePath,
					lineNumber,
					eventData.configIndex,
					formData,
				);
			},
			onOpenNote: async (sourcePath, lineNumber) => {
				await openFileAtLine(this.app, sourcePath, lineNumber);
			},
			onDelete: async (sourcePath, lineNumber) => {
				await this.plugin.dailyNoteService.deleteTask(sourcePath, lineNumber);
			},
		}).open();
	}

	private async handleDateSelect(selectInfo: SelectInfo): Promise<void> {
		const startDate = selectInfo.startStr.slice(0, 10);
		const startTime = selectInfo.startStr.includes("T")
			? selectInfo.startStr.slice(11, 16)
			: "";
		const endDate = selectInfo.allDay
			? (() => {
					const d = new Date(selectInfo.endStr);
					d.setDate(d.getDate() - 1);
					return d.toISOString().slice(0, 10);
				})()
			: selectInfo.endStr.slice(0, 10);
		const endTime = selectInfo.endStr.includes("T")
			? selectInfo.endStr.slice(11, 16)
			: "";

		const modal = new TaskFormModal(this.app, {
			mode: "create",
			taskConfigs: this.plugin.settings.taskConfigs,
			initialData: {
				allDay: selectInfo.allDay,
				startDate,
				startTime,
				endDate,
				endTime,
			},
		});

		const formData = await modal.show();
		if (!formData) return;

		await this.plugin.dailyNoteService.appendTaskToDailyNote(
			startDate,
			formData,
		);
	}

	private async handleEventDrop(info: EventDropArg): Promise<void> {
		const { sourcePath, lineNumber, configIndex } = info.event.extendedProps;
		if (!sourcePath) {
			info.revert();
			return;
		}

		try {
			await this.plugin.dailyNoteService.moveTask(
				sourcePath,
				lineNumber,
				configIndex ?? 0,
				{
					newStartDate: info.event.startStr.slice(0, 10),
					newStartTime: info.event.startStr.includes("T")
						? info.event.startStr.slice(11, 16)
						: undefined,
					newEndDate: info.event.endStr?.slice(0, 10),
					newEndTime: info.event.endStr?.includes("T")
						? info.event.endStr.slice(11, 16)
						: undefined,
					allDay: info.event.allDay,
				},
			);
		} catch (e) {
			info.revert();
			console.error("Failed to move task:", e);
		}
	}

	private async handleEventResize(info: EventResizeDoneArg): Promise<void> {
		const { sourcePath, lineNumber } = info.event.extendedProps;
		if (!sourcePath) {
			info.revert();
			return;
		}

		try {
			await this.plugin.dailyNoteService.resizeTask(sourcePath, lineNumber, {
				newEndDate: info.event.endStr?.slice(0, 10),
				newEndTime: info.event.endStr?.includes("T")
					? info.event.endStr.slice(11, 16)
					: undefined,
			});
		} catch (e) {
			info.revert();
			console.error("Failed to resize task:", e);
		}
	}
}
