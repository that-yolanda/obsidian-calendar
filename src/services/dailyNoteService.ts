import {
	type App,
	type CachedMetadata,
	moment,
	normalizePath,
	TFile,
} from "obsidian";
import {
	type CalendarEvent,
	type ObCalendarSettings,
	TASK_CHAR_STATUS_MAP,
	TASK_STATUS_CHAR_MAP,
	type TaskConfig,
	type TaskFormData,
	type TaskInfo,
} from "../types";

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

		const allEvents: CalendarEvent[] = [];
		for (const file of this.getConfiguredFiles()) {
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
		const applicableConfigIndices = this.getApplicableConfigIndices(file);
		if (applicableConfigIndices.length === 0) {
			if (this.cache.delete(file.path)) {
				this.notifyListeners();
			}
			return;
		}

		const events = await this.parseFile(file, applicableConfigIndices);
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

	async appendTaskToDailyNote(
		_date: string,
		formData: TaskFormData,
	): Promise<void> {
		const config = this.getTaskConfig(formData.configIndex);
		const taskBlock = this.formatTaskLine(formData, config.type);
		await this.appendRawTaskToConfig(config, formData.startDate, taskBlock);
	}

	async deleteTask(sourcePath: string, lineNumber: number): Promise<void> {
		await this.removeTaskBlock(sourcePath, lineNumber);
	}

	async updateTask(
		sourcePath: string,
		lineNumber: number,
		originalConfigIndex: number,
		formData: TaskFormData,
	): Promise<void> {
		const nextConfig = this.getTaskConfig(formData.configIndex);
		const targetPath = this.getTargetFilePath(nextConfig, formData.startDate);
		const updatedBlock = this.formatTaskLine(formData, nextConfig.type);

		if (
			originalConfigIndex === formData.configIndex &&
			targetPath === sourcePath
		) {
			await this.replaceTaskBlock(sourcePath, lineNumber, updatedBlock);
			return;
		}

		const removedBlock = await this.removeTaskBlock(sourcePath, lineNumber);
		try {
			await this.appendRawTaskToConfig(
				nextConfig,
				formData.startDate,
				updatedBlock || removedBlock,
			);
		} catch (error) {
			const originalConfig = this.getTaskConfig(originalConfigIndex);
			await this.appendRawTaskToConfig(
				originalConfig,
				this.getOriginalTaskDate(sourcePath, removedBlock, originalConfig.type),
				removedBlock,
			);
			throw error;
		}
	}

	async moveTask(
		sourcePath: string,
		lineNumber: number,
		configIndex: number,
		newTime: {
			newStartDate: string;
			newStartTime?: string;
			newEndDate?: string;
			newEndTime?: string;
			allDay: boolean;
		},
	): Promise<void> {
		const config = this.getTaskConfig(configIndex);
		const targetPath = this.getTargetFilePath(config, newTime.newStartDate);

		if (config.type === "daily-note" && targetPath !== sourcePath) {
			const removedBlock = await this.removeTaskBlock(sourcePath, lineNumber);
			const updatedBlock = this.rewriteTaskDates(
				removedBlock,
				newTime,
				config.type,
			);
			await this.appendRawTaskToConfig(
				config,
				newTime.newStartDate,
				updatedBlock,
			);
			return;
		}

		await this.updateTaskTime(sourcePath, lineNumber, newTime, config.type);
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

	private getTaskConfig(index: number): TaskConfig {
		const config = this.settings.taskConfigs[index];
		if (!config) {
			throw new Error("Task config not found");
		}
		return config;
	}

	private getConfiguredFiles(): TFile[] {
		const files = new Map<string, TFile>();
		const hasDailyNoteConfig = this.settings.taskConfigs.some(
			(config) => config.type === "daily-note",
		);

		if (hasDailyNoteConfig) {
			for (const file of this.getDailyNoteFiles()) {
				files.set(file.path, file);
			}
		}

		for (const config of this.settings.taskConfigs) {
			if (config.type !== "file" || !config.targetFile) continue;

			const file = this.app.vault.getAbstractFileByPath(
				normalizePath(config.targetFile),
			);
			if (file instanceof TFile) {
				files.set(file.path, file);
			}
		}

		return [...files.values()];
	}

	private getApplicableConfigIndices(file: TFile): number[] {
		const indices: number[] = [];

		for (const [index, config] of this.settings.taskConfigs.entries()) {
			if (!config.heading) continue;

			if (config.type === "daily-note" && this.isDailyNote(file)) {
				indices.push(index);
				continue;
			}

			if (
				config.type === "file" &&
				config.targetFile &&
				normalizePath(config.targetFile) === file.path
			) {
				indices.push(index);
			}
		}

		return indices;
	}

	private async parseFile(
		file: TFile,
		applicableConfigIndices = this.getApplicableConfigIndices(file),
	): Promise<CalendarEvent[]> {
		if (applicableConfigIndices.length === 0) return [];

		const fallbackDate = this.extractDateFromFilePath(file.path);
		const content = await this.app.vault.read(file);
		const tasks = this.parseTasks(content, fallbackDate);
		const cache = this.app.metadataCache.getCache(file.path);
		const filteredTasks = this.filterTasksByConfigs(
			tasks,
			content,
			cache,
			applicableConfigIndices,
		);

		return filteredTasks.map((task) => this.taskToEvent(task, file.path));
	}

	private parseTasks(content: string, fallbackDate: string | null): TaskInfo[] {
		const tasks: TaskInfo[] = [];
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;

			const task = this.parseCheckboxLine(line, i, fallbackDate);
			if (!task) continue;

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

		return tasks;
	}

	private parseCheckboxLine(
		line: string,
		lineNumber: number,
		fallbackDate: string | null,
	): TaskInfo | null {
		const match = line.match(/^-\s+\[([ x✓/])\]\s+(.+)/);
		if (!match?.[1] || !match[2]) return null;

		const status = TASK_CHAR_STATUS_MAP[match[1]] ?? "initial";
		let text = match[2].trim();

		let date = fallbackDate ?? "";
		let startTime: string | undefined;
		let endTime: string | undefined;
		let endDate: string | undefined;

		const timedMatch = text.match(
			/\{(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\}/,
		);
		if (timedMatch) {
			date = timedMatch[1] ?? date;
			startTime = timedMatch[2];
			endDate = timedMatch[3];
			endTime = timedMatch[4];
			text = text.replace(timedMatch[0], "").trim();
		} else {
			const allDayMatch = text.match(/\{(\d{4}-\d{2}-\d{2})\}/);
			if (allDayMatch?.[1]) {
				date = allDayMatch[1];
				text = text.replace(allDayMatch[0], "").trim();
			}
		}

		if (!date) return null;

		return {
			text,
			status,
			statusChar: match[1],
			date,
			endDate,
			startTime,
			endTime,
			lineNumber,
			configIndex: -1,
		};
	}

	private filterTasksByConfigs(
		tasks: TaskInfo[],
		content: string,
		cache: CachedMetadata | null,
		configIndices: number[],
	): TaskInfo[] {
		if (configIndices.length === 0) return [];
		if (!cache?.headings) return [];

		const result: TaskInfo[] = [];
		const lines = content.split("\n");

		for (const configIndex of configIndices) {
			const config = this.settings.taskConfigs[configIndex];
			const headingName = config?.heading;
			if (!headingName) continue;

			const heading = cache.headings.find(
				(item) => item.heading.toLowerCase() === headingName.toLowerCase(),
			);
			if (!heading) continue;

			const headingLine = heading.position.start.line;
			const headingLevel = heading.level;

			let endLine = lines.length;
			for (const nextHeading of cache.headings) {
				if (
					nextHeading.level <= headingLevel &&
					nextHeading.position.start.line > headingLine
				) {
					endLine = nextHeading.position.start.line;
					break;
				}
			}

			for (const task of tasks) {
				if (task.lineNumber > headingLine && task.lineNumber < endLine) {
					result.push({ ...task, configIndex });
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
			statusChar: task.statusChar,
			details: task.details,
			sourcePath,
			lineNumber: task.lineNumber,
			configIndex: task.configIndex,
		};
	}

	private formatTaskLine(
		formData: TaskFormData,
		configType: TaskConfig["type"],
	): string {
		const checkbox = TASK_STATUS_CHAR_MAP[formData.status] ?? " ";

		let line = `- [${checkbox}] ${formData.name}`;

		if (formData.allDay) {
			if (configType === "file") {
				line += ` {${formData.startDate}}`;
			}
		} else {
			line += ` {${formData.startDate} ${formData.startTime} - ${formData.endDate} ${formData.endTime}}`;
		}

		if (formData.details) {
			const detailLines = formData.details
				.split("\n")
				.map((detail) => `\t${detail}`)
				.join("\n");
			line += `\n${detailLines}`;
		}

		return line;
	}

	private async appendRawTaskToConfig(
		config: TaskConfig,
		date: string,
		taskLine: string,
	): Promise<void> {
		const file = await this.ensureTargetFile(config, date);
		const content = await this.app.vault.read(file);
		const { insertionPoint, headingExists } = this.findTaskInsertionPoint(
			content,
			config.heading,
		);
		const lines = content.split("\n");

		if (!headingExists && config.heading) {
			this.appendTaskSection(lines, config.heading, taskLine);
		} else {
			this.removeBlankLinesAt(lines, insertionPoint);
			lines.splice(insertionPoint, 0, taskLine);
		}

		await this.app.vault.modify(file, lines.join("\n"));
	}

	private async replaceTaskBlock(
		sourcePath: string,
		lineNumber: number,
		taskBlock: string,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error("File not found");

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const range = this.getTaskBlockRange(lines, lineNumber);
		lines.splice(
			range.start,
			range.end - range.start,
			...taskBlock.split("\n"),
		);
		await this.app.vault.modify(file, lines.join("\n"));
	}

	private async removeTaskBlock(
		sourcePath: string,
		lineNumber: number,
	): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error("File not found");

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const range = this.getTaskBlockRange(lines, lineNumber);
		const removedLines = lines.slice(range.start, range.end);
		lines.splice(range.start, range.end - range.start);
		await this.app.vault.modify(file, lines.join("\n"));
		return removedLines.join("\n");
	}

	private getTaskBlockRange(
		lines: string[],
		lineNumber: number,
	): { start: number; end: number } {
		const line = lines[lineNumber];
		if (!line) throw new Error("Task line not found");

		let end = lineNumber + 1;
		while (end < lines.length) {
			const nextLine = lines[end];
			if (!nextLine || !/^\s+(.+)/.test(nextLine)) break;
			end++;
		}

		return { start: lineNumber, end };
	}

	private async ensureTargetFile(
		config: TaskConfig,
		date: string,
	): Promise<TFile> {
		const filePath = this.getTargetFilePath(config, date);
		let file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) return file;

		const folderPath = filePath.includes("/")
			? filePath.slice(0, filePath.lastIndexOf("/"))
			: "";
		if (folderPath) {
			await this.ensureFolderExists(folderPath);
		}

		const initialContent =
			config.type === "daily-note" ? await this.readTemplateContent() : "";
		file = await this.app.vault.create(filePath, initialContent);
		if (!(file instanceof TFile)) {
			throw new Error("Failed to create task file");
		}

		return file;
	}

	private getTargetFilePath(config: TaskConfig, date: string): string {
		if (config.type === "daily-note") {
			return this.getDailyNotePath(date);
		}

		const targetFile = normalizePath(config.targetFile);
		if (!targetFile) {
			throw new Error("Project task target file is required");
		}
		return targetFile;
	}

	private getOriginalTaskDate(
		sourcePath: string,
		taskBlock: string,
		configType: TaskConfig["type"],
	): string {
		const timedMatch = taskBlock.match(
			/\{(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}\s*-\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\}/,
		);
		if (timedMatch?.[1]) return timedMatch[1];

		const allDayMatch = taskBlock.match(/\{(\d{4}-\d{2}-\d{2})\}/);
		if (allDayMatch?.[1]) return allDayMatch[1];

		if (configType === "daily-note") {
			return this.extractDateFromFilePath(sourcePath) ?? "";
		}

		return "";
	}

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
		const periodicTemplatePath: string =
			appAny.plugins?.plugins?.["periodic-notes"]?.settings?.daily?.template ??
			"";

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
		const folder = this.getDailyNoteFolder();
		if (folder && !file.path.startsWith(`${folder}/`)) {
			return false;
		}
		return this.extractDateFromFilePath(file.path) !== null;
	}

	private getDailyNotePath(date: string): string {
		const folder = this.getDailyNoteFolder();
		const format = this.getDailyNoteFormat();
		const parsedDate = moment(date, "YYYY-MM-DD", true);
		const formattedPath =
			format && parsedDate.isValid() ? parsedDate.format(format) : date;
		const filePath = formattedPath.endsWith(".md")
			? formattedPath
			: `${formattedPath}.md`;

		return folder
			? normalizePath(`${folder}/${filePath}`)
			: normalizePath(filePath);
	}

	private getDailyNoteFormat(): string {
		// biome-ignore lint/suspicious/noExplicitAny: Obsidian internal/community plugin API
		const appAny = this.app as any;
		const coreFormat: string =
			appAny.internalPlugins?.getPluginById("daily-notes")?.instance?.options
				?.format ?? "";
		const periodicFormat: string =
			appAny.plugins?.plugins?.["periodic-notes"]?.settings?.daily?.format ??
			"";

		return coreFormat || periodicFormat || "YYYY-MM-DD";
	}

	private getDailyNoteFolder(): string {
		// biome-ignore lint/suspicious/noExplicitAny: Obsidian internal/community plugin API
		const appAny = this.app as any;
		const coreFolder: string =
			appAny.internalPlugins?.getPluginById("daily-notes")?.instance?.options
				?.folder ?? "";
		const periodicFolder: string =
			appAny.plugins?.plugins?.["periodic-notes"]?.settings?.daily?.folder ??
			"";

		return normalizePath(coreFolder || periodicFolder || "");
	}

	private extractDateFromFilePath(filePath: string): string | null {
		const normalizedPath = normalizePath(filePath).replace(/\.md$/, "");
		const folder = this.getDailyNoteFolder();
		const relativePath =
			folder && normalizedPath.startsWith(`${folder}/`)
				? normalizedPath.slice(folder.length + 1)
				: normalizedPath;
		const parsedByFormat = this.parseDateByFormat(relativePath);
		if (parsedByFormat) {
			return parsedByFormat;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			return this.extractDateFromFileName(file.name);
		}
		return null;
	}

	private parseDateByFormat(path: string): string | null {
		const format = this.getDailyNoteFormat();
		if (!format) return null;

		const parsed = moment(path, format, true);
		if (!parsed.isValid()) {
			return null;
		}

		return parsed.format("YYYY-MM-DD");
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

	private findTaskInsertionPoint(
		content: string,
		headingName: string,
	): { insertionPoint: number; headingExists: boolean } {
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
		newTime: {
			newStartDate: string;
			newStartTime?: string;
			newEndDate?: string;
			newEndTime?: string;
			allDay: boolean;
		},
		configType: TaskConfig["type"],
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) throw new Error("File not found");

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const range = this.getTaskBlockRange(lines, lineNumber);
		const taskBlock = lines.slice(range.start, range.end).join("\n");
		const updatedBlock = this.rewriteTaskDates(taskBlock, newTime, configType);
		lines.splice(
			range.start,
			range.end - range.start,
			...updatedBlock.split("\n"),
		);
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
		configType: TaskConfig["type"],
	): string {
		const parts = taskBlock.split("\n");
		const firstLine = parts[0] ?? "";
		const rest = parts.slice(1).join("\n");

		let updated = firstLine;
		if (newTime.allDay) {
			updated =
				configType === "file"
					? firstLine.replace(/\s*\{[^}]+\}/, ` {${newTime.newStartDate}}`)
					: firstLine.replace(/\s*\{[^}]+\}/, "");
			if (!/\{[^}]+\}/.test(firstLine) && configType === "file") {
				updated = `${firstLine} {${newTime.newStartDate}}`;
			}
		} else {
			const newTimeBlock = `{${newTime.newStartDate} ${newTime.newStartTime} - ${newTime.newEndDate ?? newTime.newStartDate} ${newTime.newEndTime}}`;
			if (/\{[^}]+\}/.test(firstLine)) {
				updated = firstLine.replace(/\{[^}]+\}/, newTimeBlock);
			} else {
				const match = firstLine.match(/^(\s*-\s+\[[^\]]+\]\s+[^{]+)/);
				if (match?.[1]) {
					updated = `${match[1].trimEnd()} ${newTimeBlock}`;
				}
			}
		}

		return rest ? `${updated}\n${rest}` : updated;
	}
}
