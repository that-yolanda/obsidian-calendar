import {
	AbstractInputSuggest,
	type App,
	normalizePath,
	PluginSettingTab,
	SettingGroup,
	TFile,
} from "obsidian";
import { t } from "./i18n";
import type ObCalendarPlugin from "./main";

export { DEFAULT_SETTINGS, type ObCalendarSettings } from "./types";

import type { ObsidianInternalApp } from "./types";
import {
	DEFAULT_STATS_BAR_COLOR,
	DEFAULT_TASK_DARK_COLOR,
	DEFAULT_TASK_LIGHT_COLOR,
	TASK_STATUS_OPTIONS,
	type TaskConfig,
	type TaskConfigType,
} from "./types";

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

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("ob-calendar-settings");

		void this.renderSettingsContent(containerEl);
	}

	private async renderSettingsContent(containerEl: HTMLElement): Promise<void> {
		await this.renderTaskConfigs(containerEl);
		this.renderCalendarPreferences(containerEl);
		this.renderStatsChartColors(containerEl);
	}

	private async getTemplateHeadings(): Promise<string[]> {
		const appInternal = this.app as unknown as ObsidianInternalApp;
		const dailyNotesPlugin =
			appInternal.internalPlugins?.getPluginById("daily-notes");
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
			lightColor: DEFAULT_TASK_LIGHT_COLOR,
			darkColor: DEFAULT_TASK_DARK_COLOR,
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

		const group = new SettingGroup(containerEl).setHeading(
			t("settings.taskConfig"),
		);

		for (let i = 0; i < taskConfigs.length; i++) {
			const index = i;
			const config = taskConfigs[index];
			if (!config) continue;

			if (config.heading.trim()) {
				const typeLabel =
					config.type === "daily-note"
						? t("taskType.dailyNote")
						: t("taskType.project");
				group.addSetting((setting) => {
					setting
						.setName(config.heading)
						.setDesc(typeLabel)
						.addColorPicker((picker) => {
							picker
								.setValue(config.lightColor)
								.onChange(async (value: string) => {
									const item = this.plugin.settings.taskConfigs[index];
									if (item) item.lightColor = value;
									await this.plugin.saveSettings();
								});
						})
						.addColorPicker((picker) => {
							picker
								.setValue(config.darkColor)
								.onChange(async (value: string) => {
									const item = this.plugin.settings.taskConfigs[index];
									if (item) item.darkColor = value;
									await this.plugin.saveSettings();
								});
						})
						.addButton((btn) => {
							btn
								.setIcon("trash")
								.setTooltip(t("settings.delete"))
								.onClick(async () => {
									this.plugin.settings.taskConfigs.splice(index, 1);
									await this.plugin.saveSettings();
									this.display();
								});
						});
				});
				continue;
			}

			// Unconfigured task: single Setting with embedded form
			const availableHeadings = headingDataMap.get(index) ?? [];
			group.addSetting((setting) => {
				setting.settingEl.addClass("ob-calendar-task");
				setting.setName(t("settings.unnamedTask"));

				const fieldsEl = setting.settingEl.createDiv({
					cls: "ob-calendar-task-fields",
				});

				// Type
				const typeRow = fieldsEl.createDiv({
					cls: "ob-calendar-task-field",
				});
				typeRow.createEl("label", {
					text: t("settings.taskType"),
				});
				const typeSelect = typeRow.createEl("select");
				typeSelect.add(new Option(t("taskType.dailyNote"), "daily-note"));
				typeSelect.add(new Option(t("taskType.project"), "file"));
				typeSelect.value = config.type;

				typeSelect.addEventListener("change", () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (!item) return;
					this.manualHeadingDrafts.delete(index);
					item.type = typeSelect.value as TaskConfigType;
					if (item.type === "daily-note") {
						item.targetFile = "";
					}
					item.heading = "";
					void this.renderSettingsContent(this.containerEl);
				});

				// File
				const fileRow = fieldsEl.createDiv({
					cls: "ob-calendar-task-field",
				});
				fileRow.createEl("label", {
					text: t("settings.targetFile"),
				});

				if (config.type === "daily-note") {
					const fileInput = activeDocument.createElement("input");
					fileInput.type = "text";
					fileInput.value = t("settings.readFromDailyNotes");
					fileInput.disabled = true;
					fileRow.appendChild(fileInput);
				} else {
					const fileInput = activeDocument.createElement("input");
					fileInput.type = "search";
					fileInput.placeholder = t("settings.searchFile");
					fileInput.value = config.targetFile || "";
					fileRow.appendChild(fileInput);

					const updateTargetFile = async (value: string) => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						this.manualHeadingDrafts.delete(index);
						item.targetFile = value.trim();
						item.heading = "";
						this.display();
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
				headingRow.createEl("label", {
					text: t("settings.writeHeading"),
				});
				const headingSelect = headingRow.createEl("select");
				headingSelect.add(new Option(t("settings.selectHeading"), ""));
				for (const heading of headingOptions) {
					headingSelect.add(new Option(heading, heading));
				}
				headingSelect.add(new Option(t("settings.manualInput"), "__manual__"));
				headingSelect.value = isEditingManualHeading
					? "__manual__"
					: currentHeading;

				headingSelect.addEventListener("change", () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (!item) return;
					if (headingSelect.value === "__manual__") {
						this.manualHeadingDrafts.add(index);
						void this.renderSettingsContent(this.containerEl);
						return;
					}
					this.manualHeadingDrafts.delete(index);
					item.heading = headingSelect.value.trim();
					void (async () => {
						await this.plugin.saveSettings();
						await this.renderSettingsContent(this.containerEl);
					})();
				});

				// Manual heading
				if (isEditingManualHeading) {
					const manualRow = fieldsEl.createDiv({
						cls: "ob-calendar-task-field",
					});
					manualRow.createEl("label", {
						text: t("settings.manualHeading"),
					});
					const manualInput = activeDocument.createElement("input");
					manualInput.type = "text";
					manualInput.placeholder = t("settings.enterHeadingName");
					manualInput.value = currentHeading;
					manualRow.appendChild(manualInput);

					const commitManualHeading = async () => {
						const item = this.plugin.settings.taskConfigs[index];
						if (!item) return;
						item.heading = manualInput.value.trim();
						this.manualHeadingDrafts.delete(index);
						await this.plugin.saveSettings();
						this.display();
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
				colorRow.createEl("label", {
					text: t("settings.color"),
				});

				const lightColorInput = activeDocument.createElement("input");
				lightColorInput.type = "color";
				lightColorInput.value = config.lightColor;
				colorRow.appendChild(lightColorInput);

				lightColorInput.addEventListener("input", () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (item) item.lightColor = lightColorInput.value;
				});

				const darkColorInput = activeDocument.createElement("input");
				darkColorInput.type = "color";
				darkColorInput.value = config.darkColor;
				colorRow.appendChild(darkColorInput);

				darkColorInput.addEventListener("input", () => {
					const item = this.plugin.settings.taskConfigs[index];
					if (item) item.darkColor = darkColorInput.value;
				});

				setting.addButton((btn) => {
					btn
						.setIcon("trash")
						.setTooltip(t("settings.delete"))
						.onClick(async () => {
							this.manualHeadingDrafts.delete(index);
							this.plugin.settings.taskConfigs.splice(index, 1);
							this.display();
						});
				});
			});
		}

		// Add button
		group.addSetting((setting) => {
			setting.addButton((btn) => {
				btn
					.setIcon("plus")
					.setButtonText(t("settings.addTask"))
					.onClick(async () => {
						this.manualHeadingDrafts.clear();
						this.plugin.settings.taskConfigs.push(
							this.createDefaultTaskConfig(),
						);
						this.display();
					});
			});
		});
	}

	private renderCalendarPreferences(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading(
			t("settings.calendarPrefs"),
		);
		group.addSetting((setting) => {
			setting
				.setName(t("settings.initialView"))
				.setDesc(t("settings.initialViewDesc"))
				.addDropdown((dropdown) =>
					dropdown
						.addOptions({
							dayGridMonth: t("settings.monthView"),
							timeGridWeek: t("settings.weekView"),
							timeGridDay: t("settings.dayView"),
							listWeek: t("settings.listView"),
						})
						.setValue(this.plugin.settings.initialView)
						.onChange(async (value: string) => {
							this.plugin.settings.initialView = value;
							await this.plugin.saveSettings();
						}),
				);
		});

		group.addSetting((setting) => {
			setting
				.setName(t("settings.firstDay"))
				.setDesc(t("settings.firstDayDesc"))
				.addDropdown((dropdown) =>
					dropdown
						.addOptions({
							"0": t("settings.sunday"),
							"1": t("settings.monday"),
							"2": t("settings.tuesday"),
							"3": t("settings.wednesday"),
							"4": t("settings.thursday"),
							"5": t("settings.friday"),
							"6": t("settings.saturday"),
						})
						.setValue(String(this.plugin.settings.firstDay))
						.onChange(async (value: string) => {
							this.plugin.settings.firstDay = Number(value);
							await this.plugin.saveSettings();
						}),
				);
		});

		group.addSetting((setting) => {
			setting
				.setName(t("settings.timeFormat24h"))
				.setDesc(t("settings.timeFormat24hDesc"))
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
	private renderStatsChartColors(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading(
			t("settings.chartColors"),
		);
		group.addSetting((setting) => {
			setting.setDesc(t("settings.resetDesc"));
		});

		const colors = this.plugin.settings.statsChartColors;

		for (const status of TASK_STATUS_OPTIONS) {
			group.addSetting((s) => {
				s.setName(t(`status.${status.value}`));
				s.addColorPicker((picker) => {
					picker.setValue(colors[status.value]);
					picker.onChange(async (value: string) => {
						this.plugin.settings.statsChartColors[status.value] = value;
						await this.plugin.saveSettings();
					});
				});
				s.addExtraButton((btn) => {
					btn
						.setIcon("reset")
						.setTooltip(t("settings.resetToDefault"))
						.onClick(async () => {
							this.plugin.settings.statsChartColors[status.value] =
								status.chartColor;
							await this.plugin.saveSettings();
							this.display();
						});
				});
			});
		}

		group.addSetting((s) => {
			s.setName(t("settings.barChart"));
			s.addColorPicker((picker) => {
				picker.setValue(colors.bar);
				picker.onChange(async (value: string) => {
					this.plugin.settings.statsChartColors.bar = value;
					await this.plugin.saveSettings();
				});
			});
			s.addExtraButton((btn) => {
				btn
					.setIcon("reset")
					.setTooltip(t("settings.resetToDefault"))
					.onClick(async () => {
						this.plugin.settings.statsChartColors.bar = DEFAULT_STATS_BAR_COLOR;
						await this.plugin.saveSettings();
						this.display();
					});
			});
		});
	}
}
