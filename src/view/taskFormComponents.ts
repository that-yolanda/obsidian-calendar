import { type App, MarkdownRenderer, Setting } from "obsidian";
import type { TaskStatus } from "../types";

export const TASK_STATUS_OPTIONS: {
	value: TaskStatus;
	label: string;
	taskChar: string;
}[] = [
	{ value: "initial", label: "未开始", taskChar: " " },
	{ value: "incomplete", label: "未完成", taskChar: "/" },
	{ value: "completed", label: "完成", taskChar: "✓" },
	{ value: "cancelled", label: "取消", taskChar: "x" },
];

export function addMarkdownEditorSetting(
	container: HTMLElement,
	app: App,
	owner: object,
	label: string,
	initialValue: string,
): HTMLTextAreaElement {
	const setting = new Setting(container).setName(label);
	setting.settingEl.addClass("ob-calendar-md-setting");
	setting.controlEl.empty();

	const editorWrapper = setting.controlEl.createDiv({
		cls: "ob-calendar-md-editor markdown-source-view mod-cm6",
	});

	const previewEl = editorWrapper.createDiv({
		cls: "ob-calendar-md-preview markdown-rendered",
	});
	const previewContent = previewEl.createDiv({
		cls: "markdown-preview-view",
	});

	const textarea = editorWrapper.createEl("textarea", {
		cls: "ob-calendar-md-textarea",
	});
	textarea.value = initialValue;
	textarea.rows = 4;
	textarea.style.display = "none";

	let isEditing = false;

	const renderPreview = async () => {
		previewContent.empty();
		const text = textarea.value.trim();

		if (text) {
			previewEl.removeClass("is-empty");
			await MarkdownRenderer.render(
				app,
				text,
				previewContent,
				"",
				// biome-ignore lint/suspicious/noExplicitAny: Modal extends Component at runtime
				owner as any,
			);
			return;
		}

		previewEl.addClass("is-empty");
		previewContent.setText("点击编辑...");
	};

	previewEl.addEventListener("click", () => {
		if (isEditing) return;

		isEditing = true;
		editorWrapper.addClass("is-editing");
		previewEl.style.display = "none";
		textarea.style.display = "";
		textarea.focus();
	});

	textarea.addEventListener("blur", () => {
		isEditing = false;
		editorWrapper.removeClass("is-editing");
		textarea.style.display = "none";
		previewEl.style.display = "";
		void renderPreview();
	});

	void renderPreview();
	return textarea;
}

export function addTaskStatusSetting(
	container: HTMLElement,
	initialValue: TaskStatus,
): { getValue: () => TaskStatus } {
	const setting = new Setting(container).setName("任务状态");
	setting.settingEl.addClass("ob-calendar-status-setting");
	setting.controlEl.empty();
	setting.controlEl.addClass("markdown-rendered");

	const listEl = setting.controlEl.createEl("ul", {
		cls: "contains-task-list ob-calendar-status-list",
	});
	listEl.setAttribute("role", "radiogroup");
	listEl.setAttribute("aria-label", "任务状态");

	let currentValue = initialValue;
	const optionEls = new Map<TaskStatus, HTMLElement>();

	const syncSelection = () => {
		for (const [value, optionEl] of optionEls) {
			const selected = value === currentValue;
			optionEl.toggleClass("is-selected", selected);
			optionEl.setAttribute("aria-checked", selected ? "true" : "false");
		}
	};

	for (const option of TASK_STATUS_OPTIONS) {
		const itemEl = listEl.createEl("li", {
			cls: "task-list-item ob-calendar-status-option",
		});
		itemEl.setAttribute("data-task", option.taskChar);
		itemEl.setAttribute("role", "radio");
		itemEl.tabIndex = 0;

		const checkboxEl = itemEl.createEl("input", {
			type: "checkbox",
			cls: "task-list-item-checkbox",
		});
		checkboxEl.disabled = true;
		checkboxEl.checked = option.value === "completed";
		checkboxEl.setAttribute("tabindex", "-1");

		itemEl.createSpan({
			cls: "ob-calendar-status-label",
			text: option.label,
		});

		const selectOption = () => {
			currentValue = option.value;
			syncSelection();
		};

		itemEl.addEventListener("click", selectOption);
		itemEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			selectOption();
		});

		optionEls.set(option.value, itemEl);
	}

	syncSelection();
	return { getValue: () => currentValue };
}
