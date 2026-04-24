import type { Calendar, DatesSetArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import * as echarts from "echarts/core";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { t } from "../i18n";
import type ObCalendarPlugin from "../main";
import { mapEventsToInputs } from "../services/eventMapper";
import {
	StatsDataService,
	type StatsPeriodRange,
} from "../services/statsDataService";
import { CALENDAR_VIEW_TYPE, type StatsPeriod } from "../types";
import {
	type CalendarCallbacks,
	openFileAtLine,
	renderCalendar,
	type SelectInfo,
	setCalendarViewVisible,
	setStatsHeaderMode,
	setStatsToggleText,
} from "./calendarRenderer";
import {
	buildBarOption,
	buildDonutOption,
	type StatsChartTheme,
} from "./statsCharts";
import {
	renderStatsLayout,
	type StatsRenderResult,
	updateCards,
} from "./statsRenderer";
import { type TaskDetailData, TaskFormModal } from "./taskFormModal";

export class CalendarView extends ItemView {
	private plugin: ObCalendarPlugin;
	private calendar: Calendar | null = null;
	private statsDataService: StatsDataService;
	private isStatsMode = false;
	private statsResult: StatsRenderResult | null = null;
	private currentPeriod: StatsPeriod = "week";
	private currentRange: StatsPeriodRange | null = null;
	private statsRefreshToken = 0;

	constructor(leaf: WorkspaceLeaf, plugin: ObCalendarPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.statsDataService = new StatsDataService(plugin.dailyNoteService);
	}

	getViewType(): string {
		return CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("view.calendar");
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
				void this.handleDateSelect(selectInfo);
			},
			onEventsChanged: () => {
				this.refreshCalendar();
			},
			onEventDrop: (info) => {
				void this.handleEventDrop(info);
			},
			onEventResize: (info) => {
				void this.handleEventResize(info);
			},
			onEventStatusChange: (
				sourcePath,
				lineNumber,
				_configIndex,
				newStatus,
			) => {
				void this.plugin.dailyNoteService.changeTaskStatus(
					sourcePath,
					lineNumber,
					newStatus,
				);
			},
			onStatsToggle: () => {
				void this.toggleStatsMode();
			},
			onDatesSet: (dateInfo: DatesSetArg) => {
				void this.handleDatesSet(dateInfo);
			},
		};

		this.calendar = renderCalendar(
			container,
			events,
			this.plugin.settings,
			this.app,
			callbacks,
		);

		this.currentPeriod = this.viewToPeriod(this.calendar.view.type);

		this.plugin.dailyNoteService.onUpdate(() => {
			if (this.isStatsMode) {
				void this.refreshStats();
			} else {
				this.refreshCalendar();
			}
		});
	}

	onClose(): Promise<void> {
		this.destroyStats();
		this.calendar?.destroy();
		this.calendar = null;
		return Promise.resolve();
	}

	onResize(): void {
		if (this.isStatsMode && this.statsResult) {
			this.statsResult.donutChart.resize();
			this.statsResult.barChart.resize();
		} else {
			this.calendar?.updateSize();
		}
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

	public async refreshStats(reloadData = false): Promise<void> {
		if (!this.statsResult) return;

		const token = ++this.statsRefreshToken;
		if (reloadData) {
			await this.plugin.dailyNoteService.scanDailyNotes();
			if (token !== this.statsRefreshToken || !this.statsResult) return;
		}

		const range = this.getCurrentStatsRange();
		const summary = this.statsDataService.computePeriodSummary(range);

		updateCards(this.statsResult.cards, summary);

		const colors = this.plugin.settings.statsChartColors;
		const theme = getStatsChartTheme(this.containerEl);

		this.statsResult.donutChart.setOption(
			buildDonutOption(summary, colors, theme),
			{
				notMerge: true,
			},
		);
		this.statsResult.barChart.setOption(
			buildBarOption(summary, this.currentPeriod, colors, theme),
			{ notMerge: true },
		);
	}

	private viewToPeriod(viewType: string): StatsPeriod {
		return viewType === "dayGridMonth" ? "month" : "week";
	}

	private getCurrentStatsRange(): StatsPeriodRange {
		if (this.currentRange) return this.currentRange;
		if (!this.calendar) return this.dateRangeFromDates(new Date(), new Date());

		return this.dateRangeFromDates(
			this.calendar.view.currentStart,
			this.getInclusiveEnd(this.calendar.view.currentEnd),
		);
	}

	private dateRangeFromDates(start: Date, end: Date): StatsPeriodRange {
		return {
			start: this.formatDate(start),
			end: this.formatDate(end),
		};
	}

	private getInclusiveEnd(endExclusive: Date): Date {
		const end = new Date(endExclusive);
		end.setDate(end.getDate() - 1);
		return end;
	}

	private formatDate(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private async toggleStatsMode(): Promise<void> {
		this.isStatsMode = !this.isStatsMode;
		const container = this.containerEl.children[1] as HTMLElement;

		if (this.isStatsMode) {
			if (
				this.calendar &&
				!["dayGridMonth", "timeGridWeek"].includes(this.calendar.view.type)
			) {
				this.calendar.changeView("timeGridWeek");
			}
			setStatsToggleText(container, t("view.calendar"));
			setStatsHeaderMode(container, true);
			setCalendarViewVisible(container, false);
			await this.showStats(container);
		} else {
			this.statsRefreshToken++;
			setStatsToggleText(container, t("view.report"));
			setStatsHeaderMode(container, false);
			this.destroyStats();
			setCalendarViewVisible(container, true);
			this.calendar?.updateSize();
		}
	}

	private async showStats(container: HTMLElement): Promise<void> {
		let statsContainer = container.querySelector<HTMLElement>(
			".ob-calendar-stats-content",
		);
		if (!statsContainer) {
			statsContainer = container.createDiv({
				cls: "ob-calendar-stats-content",
			});
		}
		statsContainer.empty();

		this.statsResult = renderStatsLayout(statsContainer, (el: HTMLElement) =>
			echarts.init(el, undefined, {
				renderer: "svg",
			}),
		);

		await this.refreshStats(true);
	}

	private destroyStats(): void {
		if (this.statsResult) {
			this.statsResult.donutChart.dispose();
			this.statsResult.barChart.dispose();
			this.statsResult.cleanupResize();
			this.statsResult = null;
		}
		const container = this.containerEl.children[1] as HTMLElement;
		const statsContainer = container.querySelector(
			".ob-calendar-stats-content",
		);
		if (statsContainer) {
			statsContainer.remove();
		}
	}

	private async handleDatesSet(dateInfo: DatesSetArg): Promise<void> {
		this.currentPeriod = this.viewToPeriod(dateInfo.view.type);
		this.currentRange = this.dateRangeFromDates(
			dateInfo.view.currentStart,
			this.getInclusiveEnd(dateInfo.view.currentEnd),
		);

		const container = this.containerEl.children[1] as HTMLElement;
		setStatsToggleText(
			container,
			this.isStatsMode ? t("view.calendar") : t("view.report"),
		);
		setStatsHeaderMode(container, this.isStatsMode);

		if (this.isStatsMode) {
			await this.refreshStats(true);
		}
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
		const { sourcePath } = info.event.extendedProps;
		if (!sourcePath) {
			info.revert();
			return;
		}

		try {
			const extendedProps = info.event.extendedProps as Partial<{
				sourcePath: string;
				lineNumber: number;
				configIndex: number;
			}>;
			await this.plugin.dailyNoteService.moveTask(
				extendedProps.sourcePath ?? "",
				extendedProps.lineNumber ?? 0,
				extendedProps.configIndex ?? 0,
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
		const { sourcePath, lineNumber } = info.event.extendedProps as Partial<{
			sourcePath: string;
			lineNumber: number;
		}>;
		if (!sourcePath || lineNumber === undefined) {
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

function getStatsChartTheme(rootEl: HTMLElement): StatsChartTheme {
	return {
		isDarkMode: activeDocument.body.classList.contains("theme-dark"),
		textColor: resolveCssColor(rootEl, "--text-normal"),
		titleSize: resolveCssSize(rootEl, "--h2-size"),
		borderColor: resolveCssColor(rootEl, "--background-modifier-border"),
	};
}

function resolveCssColor(rootEl: HTMLElement, name: string): string {
	const el = rootEl.createSpan();
	el.style.color = `var(${name})`;
	const color = getComputedStyle(el).color;
	el.remove();
	return color;
}

function resolveCssSize(rootEl: HTMLElement, name: string): number {
	const el = rootEl.createSpan();
	el.style.fontSize = `var(${name})`;
	const value = getComputedStyle(el).fontSize;
	el.remove();
	return Number.parseFloat(value);
}
