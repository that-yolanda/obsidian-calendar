import {
	type App,
	normalizePath,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import type ObCalendarPlugin from "./main";

export { DEFAULT_SETTINGS, type ObCalendarSettings } from "./types";

export class CalendarSettingTab extends PluginSettingTab {
	app: App;
	plugin: ObCalendarPlugin;

	constructor(app: App, plugin: ObCalendarPlugin) {
		super(app, plugin);
		this.app = app;
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("ob-calendar-settings");

		this.renderDailyNoteInfo(containerEl);
		await this.renderTaskHeadings(containerEl);
		this.renderCalendarPreferences(containerEl);
	}

	private renderDailyNoteInfo(containerEl: HTMLElement): void {
		new Setting(containerEl).setHeading().setName("日记集成");

		const config = this.plugin.getDailyNoteConfig();

		new Setting(containerEl)
			.setName("日记文件夹")
			.setDesc("从 Obsidian 日记设置自动读取")
			.addText((text) =>
				text.setValue(config.folder || "（根目录）").setDisabled(true),
			);

		new Setting(containerEl)
			.setName("日期格式")
			.setDesc("从 Obsidian 日记设置自动读取")
			.addText((text) =>
				text.setValue(config.format || "YYYY-MM-DD").setDisabled(true),
			);
	}

	private async getTemplateHeadings(): Promise<string[]> {
		// biome-ignore lint/suspicious/noExplicitAny: Obsidian internal API
		const dailyNotesPlugin = (this.app as any).internalPlugins?.getPluginById(
			"daily-notes",
		);
		const rawPath: string = dailyNotesPlugin?.instance?.options?.template ?? "";

		if (!rawPath) return [];

		// Core plugin stores path without .md extension
		const templatePath = normalizePath(
			rawPath.endsWith(".md") ? rawPath : `${rawPath}.md`,
		);

		const file = this.app.vault.getAbstractFileByPath(templatePath);
		if (!(file instanceof TFile)) return [];

		// Try metadata cache first
		const cache = this.app.metadataCache.getFileCache(file);
		if (cache?.headings) {
			return cache.headings.map((h) => h.heading);
		}

		// Fallback: read file and parse headings manually
		const content = await this.app.vault.read(file);
		return this.parseHeadings(content);
	}

	private parseHeadings(content: string): string[] {
		const headings: string[] = [];
		for (const line of content.split("\n")) {
			const match = line.match(/^(#{1,6})\s+(.+)$/);
			if (match?.[2]) {
				headings.push(match[2].trim());
			}
		}
		return headings;
	}

	private async renderTaskHeadings(containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl).setHeading().setName("任务分类");

		containerEl.createEl("p", {
			text: "配置日记中的任务标题，日历将解析对应标题下的任务并使用指定颜色显示",
			cls: "ob-calendar-setting-desc",
		});

		const templateHeadings = await this.getTemplateHeadings();

		const { taskHeadings } = this.plugin.settings;

		for (let i = 0; i < taskHeadings.length; i++) {
			const index = i;
			const heading = taskHeadings[index];
			if (!heading) continue;

			const settingEl = new Setting(containerEl)
				.addDropdown((dropdown) => {
					dropdown.addOption("", "自定义输入");
					for (const h of templateHeadings) {
						dropdown.addOption(h, h);
					}
					if (heading.heading && !templateHeadings.includes(heading.heading)) {
						dropdown.addOption(heading.heading, heading.heading);
					}
					dropdown.setValue(heading.heading || "");
					dropdown.onChange(async (value: string) => {
						const item = this.plugin.settings.taskHeadings[index];
						if (item) item.heading = value;
						await this.plugin.saveSettings();
					});
				})
				.addText((text) =>
					text
						.setPlaceholder("或手动输入标题名称")
						.setValue(
							heading.heading && templateHeadings.includes(heading.heading)
								? ""
								: heading.heading,
						)
						.onChange(async (value: string) => {
							const item = this.plugin.settings.taskHeadings[index];
							if (item) item.heading = value;
							await this.plugin.saveSettings();
						}),
				)
				.addColorPicker((picker) =>
					picker
						.setValue(heading.color || "#7b3fe4")
						.onChange(async (value: string) => {
							if (this.plugin.settings.taskHeadings[index])
								this.plugin.settings.taskHeadings[index].color = value;
							await this.plugin.saveSettings();
						}),
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("删除")
						.onClick(async () => {
							this.plugin.settings.taskHeadings.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						}),
				);
			settingEl.settingEl.addClass("ob-calendar-heading-item");
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("添加任务分类")
				.setClass("ob-calendar-add-heading-btn")
				.onClick(async () => {
					this.plugin.settings.taskHeadings.push({
						heading: "",
						color: "#7b3fe4",
					});
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}

	private renderCalendarPreferences(containerEl: HTMLElement): void {
		new Setting(containerEl).setHeading().setName("日历偏好");

		new Setting(containerEl)
			.setName("初始视图")
			.setDesc("打开日历时显示的视图")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						dayGridMonth: "月视图",
						timeGridWeek: "周视图",
						timeGridDay: "日视图",
						listWeek: "列表视图",
					})
					.setValue(this.plugin.settings.initialView)
					.onChange(async (value: string) => {
						this.plugin.settings.initialView = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("周起始日")
			.setDesc("设置每周的第一天")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"0": "周日",
						"1": "周一",
						"2": "周二",
						"3": "周三",
						"4": "周四",
						"5": "周五",
						"6": "周六",
					})
					.setValue(String(this.plugin.settings.firstDay))
					.onChange(async (value: string) => {
						this.plugin.settings.firstDay = Number(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("24小时制")
			.setDesc("使用24小时制显示时间")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.timeFormat24h)
					.onChange(async (value: boolean) => {
						this.plugin.settings.timeFormat24h = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
