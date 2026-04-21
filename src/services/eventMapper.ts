import type { EventInput } from "@fullcalendar/core";
import type { CalendarEvent, ObCalendarSettings } from "../types";

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
	const headingConfig = settings.taskHeadings[event.headingIndex];
	const color = headingConfig?.color || undefined;

	return {
		id: event.id,
		title: event.title,
		start: event.startTime ? `${event.date}T${event.startTime}` : event.date,
		end: event.endTime
			? `${event.endDate || event.date}T${event.endTime}`
			: undefined,
		allDay: event.allDay,
		backgroundColor: color,
		borderColor: color,
		extendedProps: {
			completed: event.completed,
			status: event.status,
			sourcePath: event.sourcePath,
			lineNumber: event.lineNumber,
			headingIndex: event.headingIndex,
			details: event.details,
		},
	};
}
