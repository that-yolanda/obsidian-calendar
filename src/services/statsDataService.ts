import type { CalendarEvent, PeriodSummary, TaskStatusCount } from "../types";
import { TASK_STATUS_OPTIONS } from "../types";
import { formatDate, parseTimeToMinutes } from "../utils/time";
import type { DailyNoteService } from "./dailyNoteService";
export interface StatsPeriodRange {
	start: string;
	end: string;
}

export class StatsDataService {
	constructor(private dailyNoteService: DailyNoteService) {}

	computePeriodSummary(current: StatsPeriodRange): PeriodSummary {
		const events = this.dailyNoteService.getCachedEvents();
		const previous = this.getPreviousPeriodRange(current);

		const currentEvents = this.filterEventsByRange(
			events,
			current.start,
			current.end,
		);
		const previousEvents = this.filterEventsByRange(
			events,
			previous.start,
			previous.end,
		);

		const statusDistribution = this.countByStatus(currentEvents);
		const dailyTimeSpent = this.computeDailyTimeSpent(
			currentEvents,
			current.start,
			current.end,
		);
		const totalMinutes = this.sumMinutes(currentEvents);
		const prevTotalMinutes = this.sumMinutes(previousEvents);

		return {
			totalTasks: currentEvents.length,
			completedRate:
				currentEvents.length > 0
					? statusDistribution.completed / currentEvents.length
					: 0,
			totalMinutes,
			prevTotalTasks: previousEvents.length,
			prevCompletedRate:
				previousEvents.length > 0
					? this.countByStatus(previousEvents).completed / previousEvents.length
					: 0,
			prevTotalMinutes,
			statusDistribution,
			dailyTimeSpent,
		};
	}

	private getPreviousPeriodRange(current: StatsPeriodRange): StatsPeriodRange {
		const start = new Date(`${current.start}T00:00:00`);
		const end = new Date(`${current.end}T00:00:00`);
		const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
		start.setDate(start.getDate() - days);
		end.setDate(end.getDate() - days);
		return {
			start: formatDate(start),
			end: formatDate(end),
		};
	}

	private filterEventsByRange(
		events: CalendarEvent[],
		start: string,
		end: string,
	): CalendarEvent[] {
		return events.filter((e) => e.date >= start && e.date <= end);
	}

	private countByStatus(events: CalendarEvent[]): TaskStatusCount {
		const result = Object.fromEntries(
			TASK_STATUS_OPTIONS.map((option) => [option.value, 0]),
		) as TaskStatusCount;
		for (const e of events) {
			const key = e.status as keyof TaskStatusCount;
			if (key in result) {
				result[key]++;
			}
		}
		return result;
	}

	private computeDailyTimeSpent(
		events: CalendarEvent[],
		start: string,
		end: string,
	): Array<{ date: string; minutes: number }> {
		const map = new Map<string, number>();

		const current = new Date(`${start}T00:00:00`);
		const last = new Date(`${end}T00:00:00`);
		while (current <= last) {
			map.set(formatDate(current), 0);
			current.setDate(current.getDate() + 1);
		}

		for (const e of events) {
			const dur = this.computeEventDuration(e);
			if (dur > 0) {
				map.set(e.date, (map.get(e.date) ?? 0) + dur);
			}
		}

		return [...map.entries()]
			.map(([date, minutes]) => ({ date, minutes }))
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	private sumMinutes(events: CalendarEvent[]): number {
		return events.reduce((sum, e) => sum + this.computeEventDuration(e), 0);
	}

	private computeEventDuration(event: CalendarEvent): number {
		if (!event.startTime || !event.endTime) return 0;
		return (
			parseTimeToMinutes(event.endTime) - parseTimeToMinutes(event.startTime)
		);
	}
}
