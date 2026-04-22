import type { EventInput } from "@fullcalendar/core";
import type { CalendarEvent, ObCalendarSettings } from "../types";

const LIGHT_THEME_ALPHA = 0.8;
const DARK_THEME_ALPHA = 0.8;

export function mapEventsToInputs(
	events: CalendarEvent[],
	settings: ObCalendarSettings,
): EventInput[] {
	return events.map((event) => mapEventToInput(event, settings));
}

export function mapEventToInput(
	event: CalendarEvent,
	settings: ObCalendarSettings,
): EventInput {
	const taskConfig = settings.taskConfigs[event.configIndex];
	const color = taskConfig
		? getTaskBackgroundColor(
				isDarkTheme() ? taskConfig.darkColor : taskConfig.lightColor,
				isDarkTheme() ? DARK_THEME_ALPHA : LIGHT_THEME_ALPHA,
			)
		: undefined;

	return {
		id: event.id,
		title: event.title,
		start: event.startTime ? `${event.date}T${event.startTime}` : event.date,
		end: event.endTime
			? `${event.endDate || event.date}T${event.endTime}`
			: undefined,
		allDay: event.allDay,
		display: "block",
		backgroundColor: color,
		borderColor: color,
		textColor: "var(--text-normal)",
		extendedProps: {
			completed: event.completed,
			status: event.status,
			statusChar: event.statusChar,
			sourcePath: event.sourcePath,
			lineNumber: event.lineNumber,
			configIndex: event.configIndex,
			details: event.details,
		},
	};
}

function isDarkTheme(): boolean {
	return document.body.classList.contains("theme-dark");
}

function getTaskBackgroundColor(color: string, alpha: number): string {
	const rgb = hexToRgb(color);
	if (!rgb) return color;

	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
	const normalized = color.trim().replace(/^#/, "");
	if (!/^[\da-fA-F]{3}$|^[\da-fA-F]{6}$/.test(normalized)) {
		return null;
	}

	const full =
		normalized.length === 3
			? normalized
					.split("")
					.map((char) => `${char}${char}`)
					.join("")
			: normalized;

	const value = Number.parseInt(full, 16);

	return {
		r: (value >> 16) & 255,
		g: (value >> 8) & 255,
		b: value & 255,
	};
}
