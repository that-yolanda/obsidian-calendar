import { type App, Modal, Setting } from "obsidian";
import type { TaskFormData, TaskHeadingConfig } from "../types";
import {
	addMarkdownEditorSetting,
	addTaskStatusSetting,
	TASK_STATUS_OPTIONS,
} from "./taskFormComponents";

export class TaskCreationModal extends Modal {
	private resolve: ((data: TaskFormData | null) => void) | null = null;
	private initialData: {
		allDay: boolean;
		startDate: string;
		startTime: string;
		endDate: string;
		endTime: string;
	};
	private taskHeadings: TaskHeadingConfig[];

	constructor(
		app: App,
		taskHeadings: TaskHeadingConfig[],
		initialData: {
			allDay: boolean;
			startDate: string;
			startTime: string;
			endDate: string;
			endTime: string;
		},
	) {
		super(app);
		this.taskHeadings = taskHeadings;
		this.initialData = initialData;
	}

	async show(): Promise<TaskFormData | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onClose(): void {
		if (this.resolve) {
			this.resolve(null);
			this.resolve = null;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ob-calendar-modal");

		contentEl.createEl("h2", { text: "创建任务" });

		const form = contentEl.createEl("form", {
			cls: "ob-calendar-form",
		});
		form.addEventListener("submit", (e) => e.preventDefault());

		let headingSelect!: HTMLSelectElement;
		new Setting(form).setName("任务分类").addDropdown((dropdown) => {
			headingSelect = dropdown.selectEl;
			for (const [index, heading] of this.taskHeadings.entries()) {
				dropdown.addOption(
					String(index),
					heading.heading || `分类 ${index + 1}`,
				);
			}
		});

		let nameInput!: HTMLInputElement;
		new Setting(form).setName("任务名称").addText((text) => {
			nameInput = text.inputEl;
			nameInput.type = "text";
			nameInput.placeholder = "请输入任务名称";
			nameInput.required = true;
		});

		const detailsInput = addMarkdownEditorSetting(
			form,
			this.app,
			this,
			"任务详情",
			"",
		);

		// All-day toggle — native Obsidian toggle via Setting API
		let isAllDay = this.initialData.allDay;
		const allDaySetting = new Setting(form)
			.setName("全天任务")
			.addToggle((toggle) => {
				toggle.setValue(this.initialData.allDay);
				toggle.onChange((value) => {
					isAllDay = value;
					timeContainer.style.display = value ? "none" : "";
				});
			});
		allDaySetting.settingEl.addClass("ob-calendar-toggle-setting");

		// Time fields
		const timeContainer = form.createDiv({
			cls: "ob-calendar-time-group",
		});

		const startDateInput = this.addDateTimeSetting(
			timeContainer,
			"开始日期",
			"date",
			this.initialData.startDate,
		);

		const startTimeInput = this.addDateTimeSetting(
			timeContainer,
			"开始时间",
			"time",
			this.initialData.startTime,
		);

		const endDateInput = this.addDateTimeSetting(
			timeContainer,
			"结束日期",
			"date",
			this.initialData.endDate,
		);

		const endTimeInput = this.addDateTimeSetting(
			timeContainer,
			"结束时间",
			"time",
			this.initialData.endTime,
		);

		if (isAllDay) {
			timeContainer.style.display = "none";
		}

		const statusField = addTaskStatusSetting(
			form,
			TASK_STATUS_OPTIONS[0]?.value ?? "initial",
		);

		// Buttons
		const buttonContainer = form.createDiv({
			cls: "ob-calendar-form-buttons",
		});

		buttonContainer.createEl("button", {
			text: "创建",
			cls: "mod-cta",
			type: "submit",
		});

		buttonContainer
			.createEl("button", { text: "取消", type: "button" })
			.addEventListener("click", () => {
				this.resolve?.(null);
				this.resolve = null;
				this.close();
			});

		form.addEventListener("submit", () => {
			const name = nameInput.value.trim();
			if (!name) return;

			const formData: TaskFormData = {
				name,
				details: detailsInput.value.trim(),
				allDay: isAllDay,
				startDate: startDateInput.value,
				startTime: startTimeInput.value,
				endDate: endDateInput.value,
				endTime: endTimeInput.value,
				status: statusField.getValue(),
				headingIndex: Number(headingSelect.value),
			};

			this.resolve?.(formData);
			this.resolve = null;
			this.close();
		});

		nameInput.focus();
	}

	private addDateTimeSetting(
		container: HTMLElement,
		label: string,
		type: "date" | "time",
		value: string,
	): HTMLInputElement {
		const wrapper = container.createDiv({ cls: "ob-calendar-time-field" });
		let inputEl!: HTMLInputElement;

		new Setting(wrapper).setName(label).addText((text) => {
			inputEl = text.inputEl;
			inputEl.type = type;
			inputEl.value = value;
		});

		return inputEl;
	}
}
