import { type App, type CachedMetadata, normalizePath, TFile } from "obsidian";
import type {
	CalendarEvent,
	ObCalendarSettings,
	TaskFormData,
	TaskInfo,
	TaskStatus,
} from "../types";

const STATUS_MAP: Record<string, TaskStatus> = {
	" ": "initial",
	"✓": "completed",
	"/": "incomplete",
	x: "cancelled",
};

export class DailyNoteService {
	private app: App;
	private settings: ObCalendarSettings;
	private cache: Map<string, CalendarEvent[]> = new Map();
	private listeners: Array<() => void> = [];

	constructor(app: App, settings: ObCalendarSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: ObCalendarSettings): void {
		this.settings = settings;
		this.cache.clear();
	}

	onUpdate(callback: () => void): void {
		this.listeners.push(callback);
	}

	private notifyListeners(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	async scanDailyNotes(): Promise<CalendarEvent[]> {
		this.cache.clear();
		const files = this.getDailyNoteFiles();
		const allEvents: CalendarEvent[] = [];

		for (const file of files) {
			const events = await this.parseFile(file);
			if (events.length > 0) {
				this.cache.set(file.path, events);
				allEvents.push(...events);
			}
		}

		return allEvents;
	}

	getCachedEvents(): CalendarEvent[] {
		const allEvents: CalendarEvent[] = [];
		for (const events of this.cache.values()) {
			allEvents.push(...events);
		}
		return allEvents;
	}

	async handleFileChange(file: TFile): Promise<void> {
		if (!this.isDailyNote(file)) return;

		const events = await this.parseFile(file);
		if (events.length > 0) {
			this.cache.set(file.path, events);
		} else {
			this.cache.delete(file.path);
		}
		this.notifyListeners();
	}

	handleFileDelete(file: TFile): void {
		if (this.cache.has(file.path)) {
			this.cache.delete(file.path);
			this.notifyListeners();
		}
	}

	// --- Task creation ---

	async appendTaskToDailyNote(
		date: string,
		formData: TaskFormData,
	): Promise<void> {
		const folder = this.settings.dailyNoteFolder;
		const fileName = `${date}.md`;
		const filePath = folder ? `${folder}/${fileName}` : fileName;

		let file: TFile | null = this.app.vault.getAbstractFileByPath(
			filePath,
		) as TFile | null;
		let content: string;

		if (file instanceof TFile) {
			content = await this.app.vault.read(file);
		} else {
			if (folder) {
				await this.ensureFolderExists(folder);
			}
			content = await this.readTemplateContent();
			file = await this.app.vault.create(filePath, content);
		}

		const headingConfig = this.settings.taskHeadings[formData.headingIndex];
		const headingName = headingConfig?.heading ?? "";
		const taskLine = this.formatTaskLine(formData);
		const { insertionPoint, headingExists } = this.findTaskInsertionPoint(
			content,
			headingName,
		);

		const lines = content.split("\n");

		if (!headingExists && headingName) {
			this.appendTaskSection(lines, headingName, taskLine);
		} else {
			this.removeBlankLinesAt(lines, insertionPoint);
			lines.splice(insertionPoint, 0, taskLine);
		}

		await this.app.vault.modify(file, lines.join("\n"));
	}

	// --- Task update ---

	async updateTask(
		sourcePath: string,
		lineNumber: number,
		formData: TaskFormData,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error("File not found");

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const line = lines[lineNumber];
		if (!line) throw new Error("Task line not found");

		const statusChar: Record<TaskStatus, string> = {
			initial: " ",
			completed: "✓",
			incomplete: "/",
			cancelled: "x",
		};
		const checkbox = statusChar[formData.status] ?? " ";

		let newLine = `- [${checkbox}] ${formData.name}`;

		if (!formData.allDay) {
			newLine += ` {${formData.startDate} ${formData.startTime} - ${formData.endDate} ${formData.endTime}}`;
		}

		// Count detail lines after the task line
		let detailEnd = lineNumber + 1;
		while (detailEnd < lines.length) {
			const nextLine = lines[detailEnd];
			if (!nextLine || !/^\s+(.+)/.test(nextLine)) break;
			detailEnd++;
		}

		// Build replacement block
		const replacement: string[] = [newLine];
		if (formData.details) {
			for (const d of formData.details.split("\n")) {
				replacement.push(`\t${d}`);
			}
		}

		lines.splice(lineNumber, detailEnd - lineNumber, ...replacement);
		await this.app.vault.modify(file, lines.join("\n"));
	}

	// --- Task move/resize ---

	async moveTask(
		sourcePath: string,
		lineNumber: number,
		headingIndex: number,
		newTime: {
			newStartDate: string;
			newStartTime?: string;
			newEndDate?: string;
			newEndTime?: string;
			allDay: boolean;
		},
	): Promise<void> {
		const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(sourceFile instanceof TFile))
			throw new Error("Source file not found");

		const sourceDate = this.extractDateFromFileName(sourceFile.name);
		if (!sourceDate) throw new Error("Cannot extract date from source file");

		if (sourceDate === newTime.newStartDate) {
			await this.updateTaskTime(
				sourcePath,
				lineNumber,
				newTime.newStartTime,
				newTime.newEndDate ?? newTime.newStartDate,
				newTime.newEndTime,
				newTime.allDay,
			);
			return;
		}

		const content = await this.app.vault.read(sourceFile);
		const lines = content.split("\n");
		const taskLine = lines[lineNumber];
		if (!taskLine) throw new Error("Task line not found");

		const removedLines: string[] = [taskLine];
		let j = lineNumber + 1;
		while (j < lines.length) {
			const nextLine = lines[j];
			if (!nextLine || !/^\s+(.+)/.test(nextLine)) break;
			removedLines.push(nextLine);
			j++;
		}

		lines.splice(lineNumber, j - lineNumber);
		await this.app.vault.modify(sourceFile, lines.join("\n"));

		const updatedBlock = this.rewriteTaskDates(
			removedLines.join("\n"),
			newTime,
		);
		const headingConfig = this.settings.taskHeadings[headingIndex];
		await this.appendRawTaskToDailyNote(
			newTime.newStartDate,
			headingConfig?.heading ?? "",
			updatedBlock,
		);
	}

	async resizeTask(
		sourcePath: string,
		lineNumber: number,
		newEnd: { newEndDate?: string; newEndTime?: string },
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error("File not found");

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const line = lines[lineNumber];
		if (!line) throw new Error("Task line not found");

		const endDate = newEnd.newEndDate ?? "";
		const endTime = newEnd.newEndTime ?? "";
		lines[lineNumber] = line.replace(
			/(\{\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s*-\s*)\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(\})/,
			`$1${endDate} ${endTime}$2`,
		);

		await this.app.vault.modify(file, lines.join("\n"));
	}

	// --- Private helpers ---

	private async readTemplateContent(): Promise<string> {
		const templatePath = this.getDailyNoteTemplatePath();

		if (!templatePath) return "";

		const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
		if (templateFile instanceof TFile) {
			return await this.app.vault.read(templateFile);
		}
		return "";
	}

	private getDailyNoteTemplatePath(): string {
		// biome-ignore lint/suspicious/noExplicitAny: Obsidian internal/community plugin API
		const appAny = this.app as any;
		const coreTemplatePath: string =
			appAny.internalPlugins?.getPluginById("daily-notes")?.instance?.options
				?.template ?? "";
		// biome-ignore lint/suspicious/noExplicitAny: Obsidian internal/community plugin API
		const periodicTemplatePath: string =
			appAny.plugins?.plugins?.["periodic-notes"]?.settings?.daily?.template ?? "";

		const rawPath = coreTemplatePath || periodicTemplatePath;
		if (!rawPath) return "";

		const candidates = [
			normalizePath(rawPath),
			normalizePath(rawPath.endsWith(".md") ? rawPath : `${rawPath}.md`),
		];

		for (const candidate of candidates) {
			const file = this.app.vault.getAbstractFileByPath(candidate);
			if (file instanceof TFile) {
				return candidate;
			}
		}

		return "";
	}

	private getDailyNoteFiles(): TFile[] {
		const files = this.app.vault.getMarkdownFiles();
		return files.filter((file) => this.isDailyNote(file));
	}

	private isDailyNote(file: TFile): boolean {
		const folder = this.settings.dailyNoteFolder;
		if (folder && !file.path.startsWith(`${folder}/`)) {
			return false;
		}
		return this.extractDateFromFileName(file.name) !== null;
	}

	private extractDateFromFileName(fileName: string): string | null {
		const baseName = fileName.replace(/\.md$/, "");
		const match = baseName.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!match?.[1] || !match[2] || !match[3]) return null;

		const year = match[1];
		const month = match[2];
		const day = match[3];
		const monthNum = Number.parseInt(month, 10);
		const dayNum = Number.parseInt(day, 10);

		if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
			return null;
		}

		return `${year}-${month}-${day}`;
	}

	private async parseFile(file: TFile): Promise<CalendarEvent[]> {
		const date = this.extractDateFromFileName(file.name);
		if (!date) return [];

		const content = await this.app.vault.read(file);
		const tasks = this.parseTasks(content, date);
		const cache = this.app.metadataCache.getCache(file.path);

		const filteredTasks = this.filterTasksByHeadings(tasks, content, cache);

		return filteredTasks.map((task) => this.taskToEvent(task, file.path));
	}

	private parseTasks(content: string, date: string): TaskInfo[] {
		const tasks: TaskInfo[] = [];
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			const task = this.parseCheckboxLine(line, i, date);
			if (task) {
				const detailLines: string[] = [];
				let j = i + 1;
				while (j < lines.length) {
					const nextLine = lines[j];
					if (!nextLine || !/^\s+(.+)/.test(nextLine)) break;
					detailLines.push(nextLine.replace(/^\t/, ""));
					j++;
				}
				if (detailLines.length > 0) {
					task.details = detailLines.join("\n");
				}
				tasks.push(task);
			}
		}

		return tasks;
	}

	private parseCheckboxLine(
		line: string,
		lineNumber: number,
		date: string,
	): TaskInfo | null {
		const match = line.match(/^-\s+\[([ x✓/])\]\s+(.+)/);
		if (!match?.[1] || !match[2]) return null;

		const status = STATUS_MAP[match[1]] ?? "initial";
		let text = match[2].trim();

		let startTime: string | undefined;
		let endTime: string | undefined;
		let endDate: string | undefined;

		const timeMatch = text.match(
			/\{(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\}/,
		);
		if (timeMatch) {
			startTime = timeMatch[2];
			endDate = timeMatch[3];
			endTime = timeMatch[4];
			text = text.replace(timeMatch[0], "").trim();
		}

		return {
			text,
			status,
			date,
			endDate,
			startTime,
			endTime,
			lineNumber,
			headingIndex: -1,
		};
	}

	private filterTasksByHeadings(
		tasks: TaskInfo[],
		content: string,
		cache: CachedMetadata | null,
	): TaskInfo[] {
		const { taskHeadings } = this.settings;
		if (taskHeadings.length === 0) return tasks;
		if (!cache?.headings) return tasks;

		const result: TaskInfo[] = [];

		for (let hi = 0; hi < taskHeadings.length; hi++) {
			const headingName = taskHeadings[hi]?.heading;
			if (!headingName) continue;

			const heading = cache.headings.find(
				(h) => h.heading.toLowerCase() === headingName.toLowerCase(),
			);
			if (!heading) continue;

			const headingLine = heading.position.start.line;
			const headingLevel = heading.level;

			let endLine = content.split("\n").length;
			for (const h of cache.headings) {
				if (h.level <= headingLevel && h.position.start.line > headingLine) {
					endLine = h.position.start.line;
					break;
				}
			}

			for (const task of tasks) {
				if (task.lineNumber > headingLine && task.lineNumber < endLine) {
					task.headingIndex = hi;
					result.push(task);
				}
			}
		}

		return result;
	}

	private taskToEvent(task: TaskInfo, sourcePath: string): CalendarEvent {
		return {
			id: `${sourcePath}::${task.lineNumber}`,
			title: task.text,
			date: task.date,
			endDate: task.endDate,
			startTime: task.startTime,
			endTime: task.endTime,
			allDay: !task.startTime,
			completed: task.status === "completed",
			status: task.status,
			details: task.details,
			sourcePath,
			lineNumber: task.lineNumber,
			headingIndex: task.headingIndex,
		};
	}

	private formatTaskLine(formData: TaskFormData): string {
		const statusChar: Record<TaskStatus, string> = {
			initial: " ",
			completed: "✓",
			incomplete: "/",
			cancelled: "x",
		};
		const checkbox = statusChar[formData.status] ?? " ";

		let line = `- [${checkbox}] ${formData.name}`;

		if (!formData.allDay) {
			line += ` {${formData.startDate} ${formData.startTime} - ${formData.endDate} ${formData.endTime}}`;
		}

		if (formData.details) {
			const detailLines = formData.details
				.split("\n")
				.map((d) => `\t${d}`)
				.join("\n");
			line += `\n${detailLines}`;
		}

		return line;
	}

	private findTaskInsertionPoint(
		content: string,
		headingName: string,
	): {
		insertionPoint: number;
		headingExists: boolean;
	} {
		if (!headingName) {
			return {
				insertionPoint: content.split("\n").length,
				headingExists: false,
			};
		}

		const lines = content.split("\n");
		const escapedHeading = headingName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		for (let i = 0; i < lines.length; i++) {
			if (lines[i]?.match(new RegExp(`^#+\\s+${escapedHeading}\\s*$`, "i"))) {
				return { insertionPoint: i + 1, headingExists: true };
			}
		}

		return { insertionPoint: lines.length, headingExists: false };
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const parts = folderPath.split("/");
		let currentPath = "";
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	private async updateTaskTime(
		sourcePath: string,
		lineNumber: number,
		newStartTime?: string,
		newEndDate?: string,
		newEndTime?: string,
		allDay = false,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error("File not found");

		const sourceDate = this.extractDateFromFileName(file.name) ?? "";
		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const line = lines[lineNumber];
		if (!line) throw new Error("Task line not found");

		if (allDay) {
			lines[lineNumber] = line.replace(/\s*\{[^}]+\}/, "");
		} else if (newStartTime && newEndDate && newEndTime) {
			const newBlock = `{${sourceDate} ${newStartTime} - ${newEndDate} ${newEndTime}}`;

			if (/\{[^}]+\}/.test(line)) {
				lines[lineNumber] = line.replace(/\{[^}]+\}/, newBlock);
			} else {
				const match = line.match(/^(\s*-\s+\[[^\]]+\]\s+[^{]+)/);
				if (match?.[1]) {
					lines[lineNumber] = `${match[1].trimEnd()} ${newBlock}`;
				}
			}
		}

		await this.app.vault.modify(file, lines.join("\n"));
	}

	private rewriteTaskDates(
		taskBlock: string,
		newTime: {
			newStartDate: string;
			newStartTime?: string;
			newEndDate?: string;
			newEndTime?: string;
			allDay: boolean;
		},
	): string {
		const parts = taskBlock.split("\n");
		const firstLine = parts[0] ?? "";
		const rest = parts.slice(1).join("\n");

		if (newTime.allDay) {
			const updated = firstLine.replace(/\s*\{[^}]+\}/, "");
			return rest ? `${updated}\n${rest}` : updated;
		}

		const newTimeBlock = `{${newTime.newStartDate} ${newTime.newStartTime} - ${newTime.newEndDate ?? newTime.newStartDate} ${newTime.newEndTime}}`;

		if (/\{[^}]+\}/.test(firstLine)) {
			const updated = firstLine.replace(/\{[^}]+\}/, newTimeBlock);
			return rest ? `${updated}\n${rest}` : updated;
		}

		const match = firstLine.match(/^(\s*-\s+\[[^\]]+\]\s+[^{]+)/);
		if (match?.[1]) {
			const updated = `${match[1].trimEnd()} ${newTimeBlock}`;
			return rest ? `${updated}\n${rest}` : updated;
		}

		return taskBlock;
	}

	private async appendRawTaskToDailyNote(
		date: string,
		headingName: string,
		taskLine: string,
	): Promise<void> {
		const folder = this.settings.dailyNoteFolder;
		const fileName = `${date}.md`;
		const filePath = folder ? `${folder}/${fileName}` : fileName;

		let file: TFile | null = this.app.vault.getAbstractFileByPath(
			filePath,
		) as TFile | null;

		if (!(file instanceof TFile)) {
			if (folder) {
				await this.ensureFolderExists(folder);
			}
			const content = await this.readTemplateContent();
			file = await this.app.vault.create(filePath, content);
		}

		const content = await this.app.vault.read(file);
		const { insertionPoint, headingExists } = this.findTaskInsertionPoint(
			content,
			headingName,
		);
		const lines = content.split("\n");

		if (!headingExists && headingName) {
			this.appendTaskSection(lines, headingName, taskLine);
		} else {
			this.removeBlankLinesAt(lines, insertionPoint);
			lines.splice(insertionPoint, 0, taskLine);
		}

		await this.app.vault.modify(file, lines.join("\n"));
	}

	private appendTaskSection(
		lines: string[],
		headingName: string,
		taskLine: string,
	): void {
		while (lines.length > 0 && lines.at(-1) === "") {
			lines.pop();
		}

		if (lines.length > 0) {
			lines.push("");
		}

		lines.push(`## ${headingName}`, taskLine);
	}

	private removeBlankLinesAt(lines: string[], startIndex: number): void {
		let endIndex = startIndex;
		while (endIndex < lines.length && lines[endIndex] === "") {
			endIndex++;
		}

		if (endIndex > startIndex) {
			lines.splice(startIndex, endIndex - startIndex);
		}
	}
}
