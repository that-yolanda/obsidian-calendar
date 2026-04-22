import {
	AbstractInputSuggest,
	type App,
	normalizePath,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import type ObCalendarPlugin from "./main";

export { DEFAULT_SETTINGS, type ObCalendarSettings } from "./types";

import type { TaskConfig, TaskConfigType } from "./types";

class MarkdownFileSuggest extends AbstractInputSuggest<string> {
	private readonly filePaths: string[];

	constructor(app: App, inputEl: HTMLInputElement, filePaths: string[]) {
		super(app, inputEl);
		this.filePaths = filePaths;
		this.limit = 50;
	}

	protected getSuggestions(query: string): string[] {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) {
			return this.filePaths.slice(0, this.limit);
		}

		return this.filePaths
			.filter((path) => path.toLowerCase().includes(normalizedQuery))
			.slice(0, this.limit);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.setValue(value);
		this.close();
	}
}

export class CalendarSettingTab extends PluginSettingTab {
	app: App;
	plugin: ObCalendarPlugin;
	private manualHeadingDrafts = new Set<number>();

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

	private getMarkdownFilePaths(): string[] {
		return this.app.vault
			.getMarkdownFiles()
			.map((file) => file.path)
			.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
	}

	private createDefaultTaskConfig(): TaskConfig {
		return {
			type: "daily-note",
			heading: "",
			targetFile: "",
			lightColor: "#cccccc",
			darkColor: "#555555",
		};
	}

	private async renderTaskConfigs(containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl).setHeading().setName("任务配置");

		const templateHeadings = await this.getTemplateHeadings();
		const markdownFilePaths = this.getMarkdownFilePaths();
		const { taskConfigs } = this.plugin.settings;

		for (let i = 0; i < taskConfigs.length; i++) {
			const index = i;
			const config = taskConfigs[index];
			if (!config) continue;
			const currentHeading = config.heading.trim();
			const availableHeadings =
				config.type === "daily-note"
					? templateHeadings
					: await this.getFileHeadings(config.targetFile);
			const headingOptions = [...availableHeadings];
			if (
				currentHeading &&
				!headingOptions.some((heading) => heading === currentHeading)
			) {
				headingOptions.unshift(currentHeading);
			}
			const isEditingManualHeading = this.manualHeadingDrafts.has(index);
			const itemContainer = containerEl.createDiv({
				cls: "ob-calendar-task-config",
			});

			new Setting(itemContainer)
				.setName("任务类型")
				.addDropdown((dropdown) => {
					dropdown.addOptions({
						"daily-note": "日记任务",
						file: "项目任务",
					});
					dropdown.setValue(config.type);
					dropdown.onChange(async (value: string) => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						this.manualHeadingDrafts.delete(index);
						item.type = value as TaskConfigType;
						if (item.type === "daily-note") {
							item.targetFile = "";
						}
						item.heading = "";
						await this.plugin.saveSettings();
						await this.display();
					});
				})
				.settingEl.addClass("ob-calendar-task-config-item");

			if (config.type === "daily-note") {
				new Setting(itemContainer)
					.setName("目标文件")
					.addText((text) =>
						text.setValue("从日记配置中读取").setDisabled(true),
					)
					.settingEl.addClass("ob-calendar-task-config-item");
			} else {
				new Setting(itemContainer)
					.setName("目标文件")
					.addSearch((search) => {
						const updateTargetFile = async (value: string) => {
							const item = this.plugin.settings.taskConfigs[index];
							if (!item) return;
							this.manualHeadingDrafts.delete(index);
							item.targetFile = value.trim();
							item.heading = "";
							await this.plugin.saveSettings();
							await this.display();
						};

						search
							.setPlaceholder("搜索并选择文件")
							.setValue(config.targetFile || "");

						const suggest = new MarkdownFileSuggest(
							this.app,
							search.inputEl,
							markdownFilePaths,
						);
						suggest.onSelect((value) => {
							void updateTargetFile(value);
						});

						search.onChange((value) => {
							if (!value.trim()) {
								void updateTargetFile("");
							}
						});

						search.inputEl.addEventListener("blur", () => {
							const value = search.getValue().trim();
							if (!value || !markdownFilePaths.includes(value)) {
								search.setValue(config.targetFile || "");
								return;
							}
							if (value !== config.targetFile) {
								void updateTargetFile(value);
							}
						});

						search.inputEl.addEventListener("keydown", (event) => {
							if (event.key !== "Enter") return;
							event.preventDefault();
							search.inputEl.blur();
						});
					})
					.settingEl.addClass("ob-calendar-task-config-item");
			}

			new Setting(itemContainer)
				.setName("写入标题")
				.addDropdown((dropdown) => {
					dropdown.addOption("", "选择标题");
					for (const heading of headingOptions) {
						dropdown.addOption(heading, heading);
					}
					dropdown.addOption("__manual__", "手动填写");

					const selectedValue = isEditingManualHeading
						? "__manual__"
						: currentHeading;
					dropdown.setValue(selectedValue);
					dropdown.onChange(async (value: string) => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						if (value === "__manual__") {
							this.manualHeadingDrafts.add(index);
							await this.display();
							return;
						}
						this.manualHeadingDrafts.delete(index);
						item.heading = value.trim();
						await this.plugin.saveSettings();
						await this.display();
					});
				})
				.settingEl.addClass("ob-calendar-task-config-item");

			if (isEditingManualHeading) {
				new Setting(itemContainer)
					.setName("手动标题")
					.addText((text) => {
						const commitManualHeading = async () => {
							const item = this.plugin.settings.taskConfigs[index];
							if (!item) return;
							item.heading = text.getValue().trim();
							this.manualHeadingDrafts.delete(index);
							await this.plugin.saveSettings();
							await this.display();
						};

						text
							.setPlaceholder("输入标题名称")
							.setValue(currentHeading)
							.onChange(async (value: string) => {
								const item = this.plugin.settings.taskConfigs[index];
								if (!item) return;
								item.heading = value.trim();
								await this.plugin.saveSettings();
							});
						text.inputEl.addEventListener("blur", () => {
							void commitManualHeading();
						});
						text.inputEl.addEventListener("keydown", (event) => {
							if (event.key !== "Enter") return;
							event.preventDefault();
							text.inputEl.blur();
						});
					})
					.settingEl.addClass("ob-calendar-task-config-item");
			}

			const lightColorSetting = new Setting(itemContainer)
				.setName("浅色模式颜色")
				.addColorPicker((picker) => {
					picker
						.setValue(config.lightColor || "#cccccc")
						.onChange(async (value: string) => {
							const item = this.plugin.settings.taskConfigs[index];
							if (item) item.lightColor = value;
							await this.plugin.saveSettings();
						});
				});
			lightColorSetting.settingEl.addClass("ob-calendar-task-config-item");
			const lightColorInput =
				lightColorSetting.controlEl.querySelector<HTMLInputElement>(
					'input[type="color"]',
				);
			if (lightColorInput) {
				lightColorInput.title = "浅色模式颜色";
				lightColorInput.setAttribute("aria-label", "浅色模式颜色");
			}

			const darkColorSetting = new Setting(itemContainer)
				.setName("深色模式颜色")
				.addColorPicker((picker) => {
					picker
						.setValue(config.darkColor || "#333333")
						.onChange(async (value: string) => {
							const item = this.plugin.settings.taskConfigs[index];
							if (item) item.darkColor = value;
							await this.plugin.saveSettings();
						});
				});
			darkColorSetting.settingEl.addClass("ob-calendar-task-config-item");
			const darkColorInput =
				darkColorSetting.controlEl.querySelector<HTMLInputElement>(
					'input[type="color"]',
				);
			if (darkColorInput) {
				darkColorInput.title = "深色模式颜色";
				darkColorInput.setAttribute("aria-label", "深色模式颜色");
			}

			new Setting(itemContainer)
				.addButton((btn) =>
					btn.setButtonText("删除任务").onClick(async () => {
						this.manualHeadingDrafts.clear();
						this.plugin.settings.taskConfigs.splice(index, 1);
						await this.plugin.saveSettings();
						await this.display();
					}),
				)
				.settingEl.addClass("ob-calendar-task-config-item");
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("添加任务")
				.setClass("ob-calendar-add-heading-btn")
				.onClick(async () => {
					this.manualHeadingDrafts.clear();
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
