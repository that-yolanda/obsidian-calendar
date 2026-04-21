import { type App, Modal, Setting } from "obsidian";
import type { TaskFormData, TaskHeadingConfig, TaskStatus } from "../types";
import {
	addMarkdownEditorSetting,
	addTaskStatusSetting,
} from "./taskFormComponents";

export interface TaskDetailData {
	title: string;
	status: TaskStatus;
	allDay: boolean;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	details: string;
	sourcePath: string;
	lineNumber: number;
}

export class TaskDetailModal extends Modal {
	private data: TaskDetailData;
	private taskHeadings: TaskHeadingConfig[];
	private onSave: (
		sourcePath: string,
		lineNumber: number,
		formData: TaskFormData,
	) => Promise<void>;
	private onOpenNote: (sourcePath: string, lineNumber: number) => void;

	constructor(
		app: App,
		data: TaskDetailData,
		taskHeadings: TaskHeadingConfig[],
		onSave: (
			sourcePath: string,
			lineNumber: number,
			formData: TaskFormData,
		) => Promise<void>,
		onOpenNote: (sourcePath: string, lineNumber: number) => void,
	) {
		super(app);
		this.data = data;
		this.taskHeadings = taskHeadings;
		this.onSave = onSave;
		this.onOpenNote = onOpenNote;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ob-calendar-modal");

		contentEl.createEl("h2", { text: "编辑任务" });

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
		nameInput.value = this.data.title;

		const detailsInput = addMarkdownEditorSetting(
			form,
			this.app,
			this,
			"任务详情",
			this.data.details,
		);

		// All-day toggle — native Obsidian toggle via Setting API
		let isAllDay = this.data.allDay;
		const allDaySetting = new Setting(form)
			.setName("全天任务")
			.addToggle((toggle) => {
				toggle.setValue(this.data.allDay);
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
			this.data.startDate,
		);

		const startTimeInput = this.addDateTimeSetting(
			timeContainer,
			"开始时间",
			"time",
			this.data.startTime,
		);

		const endDateInput = this.addDateTimeSetting(
			timeContainer,
			"结束日期",
			"date",
			this.data.endDate,
		);

		const endTimeInput = this.addDateTimeSetting(
			timeContainer,
			"结束时间",
			"time",
			this.data.endTime,
		);

		if (isAllDay) {
			timeContainer.style.display = "none";
		}

		const statusField = addTaskStatusSetting(form, this.data.status);

		// Buttons
		const buttonContainer = form.createDiv({
			cls: "ob-calendar-form-buttons",
		});

		buttonContainer
			.createEl("button", { text: "打开文件", type: "button" })
			.addEventListener("click", () => {
				this.onOpenNote(this.data.sourcePath, this.data.lineNumber);
				this.close();
			});

		buttonContainer.createEl("button", {
			text: "保存",
			cls: "mod-cta",
			type: "submit",
		});

		buttonContainer
			.createEl("button", { text: "取消", type: "button" })
			.addEventListener("click", () => {
				this.close();
			});

		form.addEventListener("submit", async () => {
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

			await this.onSave(this.data.sourcePath, this.data.lineNumber, formData);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
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
