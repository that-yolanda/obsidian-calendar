import {
	type App,
	normalizePath,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import type ObCalendarPlugin from "./main";

export { DEFAULT_SETTINGS, type ObCalendarSettings } from "./types";

import type { TaskConfig, TaskConfigType } from "./types";

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

		await this.renderTaskConfigs(containerEl);
		this.renderCalendarPreferences(containerEl);
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

	private async getFileHeadings(filePath: string): Promise<string[]> {
		if (!filePath) return [];

		const file = this.app.vault.getAbstractFileByPath(normalizePath(filePath));
		if (!(file instanceof TFile)) return [];

		const cache = this.app.metadataCache.getFileCache(file);
		if (cache?.headings) {
			return cache.headings.map((h) => h.heading);
		}

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

	private getMarkdownFileOptions(): Record<string, string> {
		const files = this.app.vault
			.getMarkdownFiles()
			.map((file) => file.path)
			.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
		const options: Record<string, string> = {
			"": "选择写入文件",
		};

		for (const file of files) {
			options[file] = file;
		}

		return options;
	}

	private createDefaultTaskConfig(): TaskConfig {
		return {
			type: "daily-note",
			heading: "",
			manualHeading: false,
			targetFile: "",
			lightColor: "#8b5cf6",
			darkColor: "#a78bfa",
		};
	}

	private async renderTaskConfigs(containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl).setHeading().setName("任务配置");

		const templateHeadings = await this.getTemplateHeadings();
		const markdownFileOptions = this.getMarkdownFileOptions();
		const { taskConfigs } = this.plugin.settings;

		for (let i = 0; i < taskConfigs.length; i++) {
			const index = i;
			const config = taskConfigs[index];
			if (!config) continue;
			const availableHeadings =
				config.type === "daily-note"
					? templateHeadings
					: await this.getFileHeadings(config.targetFile);
			const usesManualHeading =
				config.manualHeading ||
				!!(config.heading && !availableHeadings.includes(config.heading));

			const rowSetting = new Setting(containerEl).addDropdown((dropdown) => {
				dropdown.addOptions({
					"daily-note": "日记任务",
					file: "项目任务",
				});
				dropdown.setValue(config.type);
				dropdown.onChange(async (value: string) => {
					const item = this.plugin.settings.taskConfigs[index];
					if (!item) return;
					item.type = value as TaskConfigType;
					if (item.type === "daily-note") {
						item.targetFile = "";
					}
					item.heading = "";
					item.manualHeading = false;
					await this.plugin.saveSettings();
					await this.display();
				});
			});

			if (config.type === "daily-note") {
				rowSetting.addText((text) =>
					text.setValue("从日记配置中读取").setDisabled(true),
				);
			} else {
				rowSetting.addDropdown((dropdown) => {
					dropdown.addOptions(markdownFileOptions);
					if (
						config.targetFile &&
						!(config.targetFile in markdownFileOptions)
					) {
						dropdown.addOption(config.targetFile, config.targetFile);
					}
					dropdown.setValue(config.targetFile || "");
					dropdown.onChange(async (value: string) => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						item.targetFile = value;
						item.heading = "";
						item.manualHeading = false;
						await this.plugin.saveSettings();
						await this.display();
					});
				});
			}

			rowSetting
				.addDropdown((dropdown) => {
					for (const heading of availableHeadings) {
						dropdown.addOption(heading, heading);
					}
					dropdown.addOption("__manual__", "手动填写");

					const selectedValue = usesManualHeading
						? "__manual__"
						: config.heading || "";
					dropdown.setValue(selectedValue);
					dropdown.onChange(async (value: string) => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						if (value === "__manual__") {
							item.manualHeading = true;
						} else {
							item.manualHeading = false;
							item.heading = value;
						}
						await this.plugin.saveSettings();
						await this.display();
					});
				})
				.addText((text) => {
					text
						.setPlaceholder("输入标题名称")
						.setValue(usesManualHeading ? config.heading : "")
						.onChange(async (value: string) => {
							const item = this.plugin.settings.taskConfigs[index];
							if (!item) return;
							item.heading = value.trim();
							item.manualHeading = true;
							await this.plugin.saveSettings();
						});

					if (!usesManualHeading) {
						text.inputEl.style.display = "none";
					}
				})
				.addColorPicker((picker) => {
					picker
						.setValue(config.lightColor || "#cccccc")
						.onChange(async (value: string) => {
							const item = this.plugin.settings.taskConfigs[index];
							if (item) item.lightColor = value;
							await this.plugin.saveSettings();
						});
				})
				.addColorPicker((picker) => {
					picker
						.setValue(config.darkColor || "#333333")
						.onChange(async (value: string) => {
							const item = this.plugin.settings.taskConfigs[index];
							if (item) item.darkColor = value;
							await this.plugin.saveSettings();
						});
				})
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("删除")
						.onClick(async () => {
							this.plugin.settings.taskConfigs.splice(index, 1);
							await this.plugin.saveSettings();
							await this.display();
						}),
				);
			rowSetting.settingEl.addClass("ob-calendar-heading-item");
			rowSetting.controlEl.addClass("ob-calendar-heading-item-control");

			const colorInputs =
				rowSetting.controlEl.querySelectorAll<HTMLInputElement>(
					'input[type="color"]',
				);
			const lightColorInput = colorInputs[0];
			const darkColorInput = colorInputs[1];

			if (lightColorInput) {
				lightColorInput.title = "浅色模式颜色";
				lightColorInput.setAttribute("aria-label", "浅色模式颜色");
			}

			if (darkColorInput) {
				darkColorInput.title = "深色模式颜色";
				darkColorInput.setAttribute("aria-label", "深色模式颜色");
			}
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("添加任务")
				.setClass("ob-calendar-add-heading-btn")
				.onClick(async () => {
					this.plugin.settings.taskConfigs.push(this.createDefaultTaskConfig());
					await this.plugin.saveSettings();
					await this.display();
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
