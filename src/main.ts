import { Plugin, TFile } from "obsidian";
import { t } from "./i18n";
import { DailyNoteService } from "./services/dailyNoteService";
import { CalendarSettingTab } from "./settings";
import {
	CALENDAR_VIEW_TYPE,
	DEFAULT_SETTINGS,
	DEFAULT_STATS_CHART_COLORS,
	DEFAULT_TASK_DARK_COLOR,
	DEFAULT_TASK_LIGHT_COLOR,
	type ObCalendarSettings,
} from "./types";
import { CalendarView } from "./view/CalendarView";

export default class ObCalendarPlugin extends Plugin {
	settings!: ObCalendarSettings;
	dailyNoteService!: DailyNoteService;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.dailyNoteService = new DailyNoteService(this.app, this.settings);

		this.registerView(CALENDAR_VIEW_TYPE, (leaf) => {
			return new CalendarView(leaf, this);
		});

		this.addRibbonIcon("calendar-glyph", t("main.openCalendar"), async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open-calendar",
			name: t("main.openCalendar"),
			callback: () => this.activateView(),
		});

		this.addSettingTab(new CalendarSettingTab(this.app, this));

		this.registerEvent(
			this.app.metadataCache.on("changed", (file: TFile) => {
				void this.dailyNoteService.handleFileChange(file);
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					this.dailyNoteService.handleFileDelete(file);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("rename", (file) => {
				if (file instanceof TFile) {
					void this.dailyNoteService.handleFileChange(file);
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				const leaves = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);
				for (const leaf of leaves) {
					const view = leaf.view;
					if (view instanceof CalendarView) {
						view.refreshCalendar();
						void view.refreshStats();
					}
				}
			}),
		);
	}

	onunload(): void {
		const calendarLeaves =
			this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);
		for (const leaf of calendarLeaves) {
			leaf.detach();
		}
	}

	async activateView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);

		if (leaves.length === 0) {
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({
				type: CALENDAR_VIEW_TYPE,
				active: true,
			});
		} else {
			const leaf = leaves[0];
			if (leaf) {
				await leaf.setViewState({
					type: CALENDAR_VIEW_TYPE,
					active: true,
				});
				void this.app.workspace.revealLeaf(leaf);
			}
		}
	}

	async loadSettings(): Promise<void> {
		const data: unknown = await this.loadData();
		this.settings = getSettingsWithDefaults(data);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.dailyNoteService.updateSettings(this.settings);
	}
}

function getSettingsWithDefaults(data: unknown): ObCalendarSettings {
	const savedSettings = isRecord(data)
		? (data as Partial<ObCalendarSettings>)
		: {};
	const settings = { ...DEFAULT_SETTINGS, ...savedSettings };

	return {
		...settings,
		taskConfigs: settings.taskConfigs.map((config) => ({
			type: config.type,
			heading: config.heading,
			targetFile: config.targetFile,
			lightColor: config.lightColor ?? DEFAULT_TASK_LIGHT_COLOR,
			darkColor: config.darkColor ?? DEFAULT_TASK_DARK_COLOR,
		})),
		statsChartColors: {
			...DEFAULT_STATS_CHART_COLORS,
			...settings.statsChartColors,
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
