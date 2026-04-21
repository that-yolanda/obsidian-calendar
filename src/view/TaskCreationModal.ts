import { type App, Modal } from "obsidian";
import type { TaskFormData, TaskHeadingConfig, TaskStatus } from "../types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
	{ value: "initial", label: "初始状态 - [ ]" },
	{ value: "completed", label: "已完成 - [✓]" },
	{ value: "incomplete", label: "未完成 - [/]" },
	{ value: "cancelled", label: "已取消 - [x]" },
];

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

		// Heading selector
		const headingSelect = this.addField(
			form,
			"任务分类",
			this.createSelect(
				this.taskHeadings.map((h, i) => ({
					value: String(i),
					label: h.heading || `分类 ${i + 1}`,
				})),
			),
		);

		// Task name
		const nameInput = this.addField(
			form,
			"任务名称",
			this.createInput("text", "请输入任务名称", true),
		);

		// Task details
		const detailsInput = this.addField(
			form,
			"任务详情",
			this.createTextarea("可选", 3),
		);

		// All-day toggle
		const allDayToggle = this.addField(form, "全天任务", this.createCheckbox());
		allDayToggle.checked = this.initialData.allDay;
		allDayToggle.id = "ob-cal-allday-toggle";
		{
			const field = allDayToggle.closest(".ob-calendar-form-field");
			const lbl = field?.querySelector("label");
			if (lbl) lbl.setAttribute("for", allDayToggle.id);
		}

		// Time fields
		const timeContainer = form.createDiv({
			cls: "ob-calendar-time-group",
		});

		const startDateInput = this.addField(
			timeContainer,
			"开始日期",
			this.createInput("date"),
		);
		startDateInput.value = this.initialData.startDate;

		const startTimeInput = this.addField(
			timeContainer,
			"开始时间",
			this.createInput("time"),
		);
		startTimeInput.value = this.initialData.startTime;

		const endDateInput = this.addField(
			timeContainer,
			"结束日期",
			this.createInput("date"),
		);
		endDateInput.value = this.initialData.endDate;

		const endTimeInput = this.addField(
			timeContainer,
			"结束时间",
			this.createInput("time"),
		);
		endTimeInput.value = this.initialData.endTime;

		const updateVisibility = () => {
			timeContainer.style.display = allDayToggle.checked ? "none" : "";
		};
		allDayToggle.addEventListener("change", updateVisibility);
		updateVisibility();

		// Status
		const statusSelect = this.addField(
			form,
			"任务状态",
			this.createSelect(STATUS_OPTIONS),
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
				allDay: allDayToggle.checked,
				startDate: startDateInput.value,
				startTime: startTimeInput.value,
				endDate: endDateInput.value,
				endTime: endTimeInput.value,
				status: statusSelect.value as TaskStatus,
				headingIndex: Number(headingSelect.value),
			};

			this.resolve?.(formData);
			this.resolve = null;
			this.close();
		});

		nameInput.focus();
	}

	private addField<T extends HTMLElement>(
		container: HTMLElement,
		label: string,
		input: T,
	): T {
		const field = container.createDiv({ cls: "ob-calendar-form-field" });
		field.createEl("label", { text: label });
		field.appendChild(input);
		return input;
	}

	private createInput(
		type: string,
		placeholder?: string,
		required?: boolean,
	): HTMLInputElement {
		const el = document.createElement("input");
		el.type = type;
		if (placeholder) el.placeholder = placeholder;
		if (required) el.required = true;
		return el;
	}

	private createTextarea(
		placeholder: string,
		rows: number,
	): HTMLTextAreaElement {
		const el = document.createElement("textarea");
		el.placeholder = placeholder;
		el.rows = rows;
		return el;
	}

	private createCheckbox(): HTMLInputElement {
		const el = document.createElement("input");
		el.type = "checkbox";
		return el;
	}

	private createSelect(
		options: { value: string; label: string }[],
	): HTMLSelectElement {
		const el = document.createElement("select");
		for (const opt of options) {
			const _option = el.createEl("option", {
				value: opt.value,
				text: opt.label,
			});
		}
		return el;
	}
}
