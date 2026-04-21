import { type App, Component, Modal, Setting } from "obsidian";
import type { TaskFormData, TaskHeadingConfig, TaskStatus } from "../types";
import {
	addMarkdownEditorSetting,
	addTaskStatusSetting,
	TASK_STATUS_OPTIONS,
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
	headingIndex: number;
}

export interface TaskDetailData extends TaskFormInitialData {
	sourcePath: string;
	lineNumber: number;
}

type CreateTaskFormOptions = {
	mode: "create";
	taskHeadings: TaskHeadingConfig[];
	initialData: TaskFormSeedData;
};

type EditTaskFormOptions = {
	mode: "edit";
	taskHeadings: TaskHeadingConfig[];
	initialData: TaskDetailData;
	onSave: (
		sourcePath: string,
		lineNumber: number,
		formData: TaskFormData,
	) => Promise<void>;
	onOpenNote: (sourcePath: string, lineNumber: number) => void | Promise<void>;
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

		const { form, nameInput, getFormData } = buildTaskForm(
			contentEl,
			this.app,
			this.markdownPreviewComponent,
			this.options.taskHeadings,
			getInitialData(this.options),
		);

		const buttonContainer = form.createDiv({
			cls: "ob-calendar-form-buttons",
		});

		if (this.options.mode === "edit") {
			const editOptions = this.options;
			buttonContainer
				.createEl("button", { text: "打开文件", type: "button" })
				.addEventListener("click", () => {
					void editOptions.onOpenNote(
						editOptions.initialData.sourcePath,
						editOptions.initialData.lineNumber,
					);
					this.close();
				});

			buttonContainer.createEl("button", {
				text: "保存",
				cls: "mod-cta",
				type: "submit",
			});
		} else {
			buttonContainer.createEl("button", {
				text: "创建",
				cls: "mod-cta",
				type: "submit",
			});
		}

		buttonContainer
			.createEl("button", { text: "取消", type: "button" })
			.addEventListener("click", () => {
				if (this.options.mode === "create") {
					this.resolve?.(null);
					this.resolve = null;
				}
				this.close();
			});

		form.addEventListener("submit", async () => {
			const formData = getFormData();
			if (!formData.name) return;

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

		nameInput.focus();
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
	nameInput: HTMLInputElement;
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
		headingIndex: 0,
	};
}

function buildTaskForm(
	container: HTMLElement,
	app: App,
	owner: Component,
	taskHeadings: TaskHeadingConfig[],
	initialData: TaskFormInitialData,
): TaskFormElements {
	const form = container.createEl("form", {
		cls: "ob-calendar-form",
	});
	form.addEventListener("submit", (e) => e.preventDefault());

	let headingSelect!: HTMLSelectElement;
	const headingSetting = new Setting(form).setName("任务分类");
	headingSetting.settingEl.addClass("ob-calendar-dropdown-setting");
	headingSetting.addDropdown((dropdown) => {
		headingSelect = dropdown.selectEl;
		for (const [index, heading] of taskHeadings.entries()) {
			dropdown.addOption(String(index), heading.heading || `分类 ${index + 1}`);
		}
		dropdown.setValue(String(initialData.headingIndex));
	});

	let nameInput!: HTMLInputElement;
	new Setting(form).setName("任务名称").addText((text) => {
		nameInput = text.inputEl;
		nameInput.type = "text";
		nameInput.placeholder = "请输入任务名称";
		nameInput.required = true;
		nameInput.value = initialData.title;
	});

	let isAllDay = initialData.allDay;

	const allDaySetting = new Setting(form)
		.setName("全天任务")
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
		"开始日期",
		initialData.startDate,
		initialData.startTime,
	);

	const endTimeRow = addDateTimeRow(
		form,
		"结束日期",
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
		"任务详情",
		initialData.details,
	);

	return {
		form,
		nameInput,
		getFormData: () => ({
			name: nameInput.value.trim(),
			details: detailsInput.value.trim(),
			allDay: isAllDay,
			startDate: startTimeRow.dateInput.value,
			startTime: startTimeRow.timeInput.value,
			endDate: endTimeRow.dateInput.value,
			endTime: endTimeRow.timeInput.value,
			status: statusField.getValue(),
			headingIndex: Number(headingSelect.value),
		}),
	};
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

	return { settingEl: setting.settingEl, dateInput, timeInput };
}
