import {
	AbstractInputSuggest,
	type App,
	normalizePath,
	PluginSettingTab,
	Setting,
	SettingGroup,
	TFile,
} from "obsidian";
import type ObCalendarPlugin from "./main";

export { DEFAULT_SETTINGS, type ObCalendarSettings } from "./types";

import type { TaskConfig, TaskConfigType } from "./types";

const DEFAULT_LIGHT_COLOR = "#cccccc";
const DEFAULT_DARK_COLOR = "#555555";
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
			lightColor: DEFAULT_LIGHT_COLOR,
			darkColor: DEFAULT_DARK_COLOR,
		};
	}

	private async renderTaskConfigs(containerEl: HTMLElement): Promise<void> {
		const templateHeadings = await this.getTemplateHeadings();
		const markdownFilePaths = this.getMarkdownFilePaths();
		const { taskConfigs } = this.plugin.settings;

		// Pre-compute heading data for unconfigured tasks
		const headingDataMap = new Map<number, string[]>();
		for (let i = 0; i < taskConfigs.length; i++) {
			const config = taskConfigs[i];
			if (!config || config.heading.trim()) continue;
			headingDataMap.set(
				i,
				config.type === "daily-note"
					? templateHeadings
					: await this.getFileHeadings(config.targetFile),
			);
		}

		const group = new SettingGroup(containerEl).setHeading("任务配置");

		for (let i = 0; i < taskConfigs.length; i++) {
			const index = i;
			const config = taskConfigs[index];
			if (!config) continue;

			if (config.heading.trim()) {
				const typeLabel =
					config.type === "daily-note" ? "日记任务" : "项目任务";
				group.addSetting((setting) => {
					setting
						.setName(config.heading)
						.setDesc(typeLabel)
						.addColorPicker((picker) => {
							picker
								.setValue(config.lightColor || DEFAULT_LIGHT_COLOR)
								.onChange(async (value: string) => {
									const item = this.plugin.settings.taskConfigs[index];
									if (item) item.lightColor = value;
									await this.plugin.saveSettings();
								});
						})
						.addColorPicker((picker) => {
							picker
								.setValue(config.darkColor || DEFAULT_DARK_COLOR)
								.onChange(async (value: string) => {
									const item = this.plugin.settings.taskConfigs[index];
									if (item) item.darkColor = value;
									await this.plugin.saveSettings();
								});
						})
						.addButton((btn) => {
							btn
								.setIcon("trash")
								.setTooltip("删除")
								.onClick(async () => {
									this.plugin.settings.taskConfigs.splice(index, 1);
									await this.plugin.saveSettings();
									await this.display();
								});
						});
				});
				continue;
			}

			// Unconfigured task: single Setting with embedded form
			const availableHeadings = headingDataMap.get(index) ?? [];
			group.addSetting((setting) => {
				setting.settingEl.addClass("ob-calendar-task");
				setting.setName("未命名任务");

				const fieldsEl = setting.settingEl.createDiv({
					cls: "ob-calendar-task-fields",
				});

				// Type
				const typeRow = fieldsEl.createDiv({
					cls: "ob-calendar-task-field",
				});
				typeRow.createEl("label", { text: "任务类型" });
				const typeSelect = typeRow.createEl("select");
				typeSelect.add(new Option("日记任务", "daily-note"));
				typeSelect.add(new Option("项目任务", "file"));
				typeSelect.value = config.type;

				typeSelect.addEventListener("change", async () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (!item) return;
					this.manualHeadingDrafts.delete(index);
					item.type = typeSelect.value as TaskConfigType;
					if (item.type === "daily-note") {
						item.targetFile = "";
					}
					item.heading = "";
					await this.display();
				});

				// File
				const fileRow = fieldsEl.createDiv({
					cls: "ob-calendar-task-field",
				});
				fileRow.createEl("label", { text: "目标文件" });

				if (config.type === "daily-note") {
					const fileInput = document.createElement("input");
					fileInput.type = "text";
					fileInput.value = "从日记配置中读取";
					fileInput.disabled = true;
					fileRow.appendChild(fileInput);
				} else {
					const fileInput = document.createElement("input");
					fileInput.type = "search";
					fileInput.placeholder = "搜索并选择文件";
					fileInput.value = config.targetFile || "";
					fileRow.appendChild(fileInput);

					const updateTargetFile = async (value: string) => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						this.manualHeadingDrafts.delete(index);
						item.targetFile = value.trim();
						item.heading = "";
						await this.display();
					};

					const suggest = new MarkdownFileSuggest(
						this.app,
						fileInput,
						markdownFilePaths,
					);
					suggest.onSelect((value) => {
						void updateTargetFile(value);
					});

					fileInput.addEventListener("input", () => {
						if (!fileInput.value.trim()) {
							void updateTargetFile("");
						}
					});

					fileInput.addEventListener("blur", () => {
						const value = fileInput.value.trim();
						if (!value || !markdownFilePaths.includes(value)) {
							fileInput.value = config.targetFile || "";
							return;
						}
						if (value !== config.targetFile) {
							void updateTargetFile(value);
						}
					});

					fileInput.addEventListener("keydown", (event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						fileInput.blur();
					});
				}

				// Heading
				const currentHeading = config.heading.trim();
				const headingOptions = [...availableHeadings];
				if (
					currentHeading &&
					!headingOptions.some((h) => h === currentHeading)
				) {
					headingOptions.unshift(currentHeading);
				}
				const isEditingManualHeading = this.manualHeadingDrafts.has(index);

				const headingRow = fieldsEl.createDiv({
					cls: "ob-calendar-task-field",
				});
				headingRow.createEl("label", { text: "写入标题" });
				const headingSelect = headingRow.createEl("select");
				headingSelect.add(new Option("选择标题", ""));
				for (const heading of headingOptions) {
					headingSelect.add(new Option(heading, heading));
				}
				headingSelect.add(new Option("手动填写", "__manual__"));
				headingSelect.value = isEditingManualHeading
					? "__manual__"
					: currentHeading;

				headingSelect.addEventListener("change", async () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (!item) return;
					if (headingSelect.value === "__manual__") {
						this.manualHeadingDrafts.add(index);
						await this.display();
						return;
					}
					this.manualHeadingDrafts.delete(index);
					item.heading = headingSelect.value.trim();
					await this.plugin.saveSettings();
					await this.display();
				});

				// Manual heading
				if (isEditingManualHeading) {
					const manualRow = fieldsEl.createDiv({
						cls: "ob-calendar-task-field",
					});
					manualRow.createEl("label", { text: "手动标题" });
					const manualInput = document.createElement("input");
					manualInput.type = "text";
					manualInput.placeholder = "输入标题名称";
					manualInput.value = currentHeading;
					manualRow.appendChild(manualInput);

					const commitManualHeading = async () => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						item.heading = manualInput.value.trim();
						this.manualHeadingDrafts.delete(index);
						await this.plugin.saveSettings();
						await this.display();
					};

					manualInput.addEventListener("input", () => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						item.heading = manualInput.value.trim();
					});

					manualInput.addEventListener("blur", () => {
						void commitManualHeading();
					});

					manualInput.addEventListener("keydown", (event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						manualInput.blur();
					});
				}

				// Colors
				const colorRow = fieldsEl.createDiv({
					cls: "ob-calendar-task-field",
				});
				colorRow.createEl("label", { text: "颜色" });

				const lightColorInput = document.createElement("input");
				lightColorInput.type = "color";
				lightColorInput.value = config.lightColor || "#cccccc";
				colorRow.appendChild(lightColorInput);

				lightColorInput.addEventListener("input", () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (item) item.lightColor = lightColorInput.value;
				});

				const darkColorInput = document.createElement("input");
				darkColorInput.type = "color";
				darkColorInput.value = config.darkColor || "#555555";
				colorRow.appendChild(darkColorInput);

				darkColorInput.addEventListener("input", () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (item) item.darkColor = darkColorInput.value;
				});

				setting.addButton((btn) => {
					btn
						.setIcon("trash")
						.setTooltip("删除")
						.onClick(async () => {
							this.manualHeadingDrafts.delete(index);
							this.plugin.settings.taskConfigs.splice(index, 1);
							await this.display();
						});
				});
			});
		}

		// Add button
		group.addSetting((setting) => {
			setting.addButton((btn) => {
				btn
					.setIcon("plus")
					.setButtonText("添加任务")
					.onClick(async () => {
						this.manualHeadingDrafts.clear();
						this.plugin.settings.taskConfigs.push(
							this.createDefaultTaskConfig(),
						);
						await this.display();
					});
			});
		});
	}

	private renderCalendarPreferences(containerEl: HTMLElement): void {

		const group = new SettingGroup(containerEl).setHeading("日历偏好");
		group.addSetting((setting) => {
			setting.setName("初始视图")
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
		});

		group.addSetting((setting) => {
			setting.setName("周起始日")
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
		});

		group.addSetting((setting) => {
			setting.setName("24小时制")
			.setDesc("使用24小时制显示时间")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.timeFormat24h)
					.onChange(async (value: boolean) => {
						this.plugin.settings.timeFormat24h = value;
						await this.plugin.saveSettings();
					}),
			);
		});
	}
}
