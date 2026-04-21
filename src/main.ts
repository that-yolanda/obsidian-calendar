import { Plugin, TFile } from "obsidian";
import { DailyNoteService } from "./services/dailyNoteService";
import { CalendarSettingTab } from "./settings";
import {
	CALENDAR_VIEW_TYPE,
	DEFAULT_SETTINGS,
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

		this.addRibbonIcon("calendar-glyph", "打开日历", async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open-calendar",
			name: "打开日历",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new CalendarSettingTab(this.app, this));

		this.registerEvent(
			this.app.metadataCache.on("changed", (file: TFile) => {
				this.dailyNoteService.handleFileChange(file);
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
					this.dailyNoteService.handleFileChange(file);
				}
			}),
		);
	}

	onunload(): void {
		const leaves = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);
		for (const leaf of leaves) {
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
				this.app.workspace.revealLeaf(leaf);
			}
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.syncDailyNoteConfig();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.dailyNoteService.updateSettings(this.settings);
	}

	getDailyNoteConfig(): {
		folder: string;
		format: string;
		template: string;
	} {
		// biome-ignore lint/suspicious/noExplicitAny: Obsidian internal API
		const dailyNotesPlugin = (this.app as any).internalPlugins?.getPluginById(
			"daily-notes",
		);
		const options = dailyNotesPlugin?.instance?.options;
		return {
			folder: options?.folder || "",
			format: options?.format || "YYYY-MM-DD",
			template: options?.template || "",
		};
	}

	private syncDailyNoteConfig(): void {
		const config = this.getDailyNoteConfig();
		this.settings.dailyNoteFolder = config.folder;
		this.settings.dailyNoteFormat = config.format;
	}
}
