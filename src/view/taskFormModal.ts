import { type App, Component, Modal, Setting } from "obsidian";
import { t } from "../i18n";
import {
	TASK_STATUS_OPTIONS,
	type TaskConfig,
	type TaskFormData,
	type TaskStatus,
} from "../types";
import {
	addMarkdownEditorSetting,
	addTaskStatusSetting,
} from "./taskFormComponents";

export interface TaskFormSeedData {
	allDay: boolean;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
}

interface TaskFormInitialData extends TaskFormSeedData {
	title: string;
	details: string;
	status: TaskStatus;
	configIndex: number;
}

export interface TaskDetailData extends TaskFormInitialData {
	sourcePath: string;
	lineNumber: number;
}

type CreateTaskFormOptions = {
	mode: "create";
	taskConfigs: TaskConfig[];
	initialData: TaskFormSeedData;
};

type EditTaskFormOptions = {
	mode: "edit";
	taskConfigs: TaskConfig[];
	initialData: TaskDetailData;
	onSave: (
		sourcePath: string,
		lineNumber: number,
		formData: TaskFormData,
	) => Promise<void>;
	onOpenNote: (sourcePath: string, lineNumber: number) => void | Promise<void>;
	onDelete: (sourcePath: string, lineNumber: number) => Promise<void>;
};

type TaskFormModalOptions = CreateTaskFormOptions | EditTaskFormOptions;

export class TaskFormModal extends Modal {
	private readonly options: TaskFormModalOptions;
	private resolve: ((data: TaskFormData | null) => void) | null = null;
	private markdownPreviewComponent: Component | null = null;

	constructor(app: App, options: TaskFormModalOptions) {
		super(app);
		this.options = options;
	}

	async show(): Promise<TaskFormData | null> {
		if (this.options.mode !== "create") {
			throw new Error("show() is only available in create mode.");
		}

		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ob-calendar-modal");

		this.markdownPreviewComponent = new Component();
		this.markdownPreviewComponent.load();

		const { form, getFormData } = buildTaskForm(
			contentEl,
			this.app,
			this.markdownPreviewComponent,
			this.options.taskConfigs,
			getInitialData(this.options),
		);

		const buttonContainer = form.createDiv({
			cls: "ob-calendar-form-buttons",
		});

		if (this.options.mode === "edit") {
			const editOptions = this.options;
			buttonContainer
				.createEl("button", {
					text: t("form.openFile"),
					type: "button",
				})
				.addEventListener("click", () => {
					void editOptions.onOpenNote(
						editOptions.initialData.sourcePath,
						editOptions.initialData.lineNumber,
					);
					this.close();
				});

			buttonContainer
				.createEl("button", {
					text: t("form.delete"),
					type: "button",
				})
				.addEventListener("click", () => {
					void editOptions.onDelete(
						editOptions.initialData.sourcePath,
						editOptions.initialData.lineNumber,
					);
					this.close();
				});

			buttonContainer.createEl("button", {
				text: t("form.save"),
				cls: "mod-cta",
				type: "submit",
			});
		} else {
			buttonContainer.createEl("button", {
				text: t("form.create"),
				cls: "mod-cta",
				type: "submit",
			});
		}

		buttonContainer
			.createEl("button", {
				text: t("form.cancel"),
				type: "button",
			})
			.addEventListener("click", () => {
				if (this.options.mode === "create") {
					this.resolve?.(null);
					this.resolve = null;
				}
				this.close();
			});

		form.addEventListener("submit", async () => {
			const formData = getFormData();
			if (!formData.title) return;

			if (this.options.mode === "edit") {
				const editOptions = this.options;
				await editOptions.onSave(
					editOptions.initialData.sourcePath,
					editOptions.initialData.lineNumber,
					formData,
				);
				this.close();
				return;
			}

			this.resolve?.(formData);
			this.resolve = null;
			this.close();
		});
	}

	onClose(): void {
		this.markdownPreviewComponent?.unload();
		this.markdownPreviewComponent = null;
		this.contentEl.empty();

		if (this.options.mode === "create" && this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
	}
}

interface TaskFormElements {
	form: HTMLFormElement;
	titleInput: HTMLInputElement;
	getFormData: () => TaskFormData;
}

function getInitialData(options: TaskFormModalOptions): TaskFormInitialData {
	if (options.mode === "edit") {
		return options.initialData;
	}

	return {
		title: "",
		details: "",
		allDay: options.initialData.allDay,
		startDate: options.initialData.startDate,
		startTime: options.initialData.startTime,
		endDate: options.initialData.endDate,
		endTime: options.initialData.endTime,
		status: "initial",
		configIndex: 0,
	};
}

function buildTaskForm(
	container: HTMLElement,
	app: App,
	owner: Component,
	taskConfigs: TaskConfig[],
	initialData: TaskFormInitialData,
): TaskFormElements {
	const form = container.createEl("form", {
		cls: "ob-calendar-form",
	});
	form.addEventListener("submit", (e) => e.preventDefault());

	let configSelect!: HTMLSelectElement;
	const configSetting = new Setting(form).setName(t("form.taskCategory"));
	configSetting.settingEl.addClass("ob-calendar-dropdown-setting");
	configSetting.addDropdown((dropdown) => {
		configSelect = dropdown.selectEl;
		for (const [index, config] of taskConfigs.entries()) {
			dropdown.addOption(String(index), formatTaskConfigLabel(config, index));
		}
		dropdown.setValue(String(initialData.configIndex));
	});

	let titleInput!: HTMLInputElement;
	new Setting(form).setName(t("form.taskName")).addText((text) => {
		titleInput = text.inputEl;
		titleInput.type = "text";
		titleInput.placeholder = t("form.enterTaskName");
		titleInput.required = true;
		titleInput.value = initialData.title;
	});

	let isAllDay = initialData.allDay;

	const allDaySetting = new Setting(form)
		.setName(t("form.allDayTask"))
		.addToggle((toggle) => {
			toggle.setValue(initialData.allDay);
			toggle.onChange((value) => {
				isAllDay = value;
				startTimeRow.settingEl.style.display = value ? "none" : "";
				endTimeRow.settingEl.style.display = value ? "none" : "";
			});
		});
	allDaySetting.settingEl.addClass("ob-calendar-toggle-setting");

	const startTimeRow = addDateTimeRow(
		form,
		t("form.startDate"),
		initialData.startDate,
		initialData.startTime,
	);

	const endTimeRow = addDateTimeRow(
		form,
		t("form.endDate"),
		initialData.endDate,
		initialData.endTime,
	);

	if (isAllDay) {
		startTimeRow.settingEl.style.display = "none";
		endTimeRow.settingEl.style.display = "none";
	}

	const statusField = addTaskStatusSetting(
		form,
		initialData.status || TASK_STATUS_OPTIONS[0]?.value || "initial",
	);

	const detailsInput = addMarkdownEditorSetting(
		form,
		app,
		owner,
		t("form.taskDetails"),
		initialData.details,
	);

	return {
		form,
		titleInput,
		getFormData: () => ({
			title: titleInput.value.trim(),
			details: detailsInput.value.trim(),
			allDay: isAllDay,
			startDate: startTimeRow.dateInput.value,
			startTime: startTimeRow.timeInput.value,
			endDate: endTimeRow.dateInput.value,
			endTime: endTimeRow.timeInput.value,
			status: statusField.getValue(),
			configIndex: Number(configSelect.value),
		}),
	};
}

function formatTaskConfigLabel(config: TaskConfig, index: number): string {
	const headingLabel = config.heading || t("form.categoryN", String(index + 1));
	if (config.type === "daily-note") {
		return `${t("taskType.dailyNote")} / ${headingLabel}`;
	}

	const fileLabel = config.targetFile || t("form.noFileSelected");
	return `${t("taskType.project")} / ${fileLabel} / ${headingLabel}`;
}

function addDateTimeRow(
	container: HTMLElement,
	label: string,
	dateValue: string,
	timeValue: string,
): {
	settingEl: HTMLElement;
	dateInput: HTMLInputElement;
	timeInput: HTMLInputElement;
} {
	const setting = new Setting(container).setName(label);
	setting.settingEl.addClass("ob-calendar-time-row");
	let dateInput!: HTMLInputElement;
	let timeInput!: HTMLInputElement;

	setting.addText((text) => {
		dateInput = text.inputEl;
		dateInput.type = "date";
		dateInput.value = dateValue;
	});

	setting.addText((text) => {
		timeInput = text.inputEl;
		timeInput.type = "time";
		timeInput.value = timeValue;
	});

	return {
		settingEl: setting.settingEl,
		dateInput,
		timeInput,
	};
}
