import type { EChartsType } from "echarts/core";
import { Setting } from "obsidian";
import { t } from "../i18n";
import type { PeriodSummary } from "../types";

export interface StatsCardElements {
	valueEl: HTMLElement;
	changeEl: HTMLElement;
}

export interface StatsCards {
	total: StatsCardElements;
	rate: StatsCardElements;
	time: StatsCardElements;
}

export interface StatsRenderResult {
	donutChart: EChartsType;
	barChart: EChartsType;
	cards: StatsCards;
	cleanupResize: () => void;
}

export function renderStatsLayout(
	container: HTMLElement,
	// biome-ignore lint/suspicious/noExplicitAny: echarts.init is typed via echarts/core
	initChart: (el: HTMLElement) => any,
): StatsRenderResult {
	const cardsContainer = container.createDiv({
		cls: "ob-calendar-stats-cards",
	});
	const cards: StatsCards = {
		total: renderCard(cardsContainer, t("stats.totalTasks")),
		rate: renderCard(cardsContainer, t("stats.completionRate")),
		time: renderCard(cardsContainer, t("stats.totalDuration")),
	};

	const chartsContainer = container.createDiv({
		cls: "ob-calendar-stats-charts",
	});
	const donutWrap = chartsContainer.createDiv({
		cls: "stats-chart-donut",
	});
	const donutEl = donutWrap.createDiv();
	const donutChart = initChart(donutEl);

	const barWrap = chartsContainer.createDiv({
		cls: "stats-chart-bar",
	});
	const barEl = barWrap.createDiv();
	const barChart = initChart(barEl);

	const observer = new ResizeObserver(() => {
		donutChart.resize();
		barChart.resize();
	});
	observer.observe(container);

	return {
		donutChart,
		barChart,
		cards,
		cleanupResize: () => observer.disconnect(),
	};
}

function renderCard(container: HTMLElement, label: string): StatsCardElements {
	const s = new Setting(container).setName(label);
	s.settingEl.addClass("ob-calendar-stat-card");
	const valueEl = s.controlEl.createDiv({
		cls: "ob-calendar-stat-value",
		text: "--",
	});
	const changeEl = s.controlEl.createSpan({
		cls: "ob-calendar-stat-change",
	});
	return { valueEl, changeEl };
}

export function updateCards(cards: StatsCards, summary: PeriodSummary): void {
	updateCardValue(cards.total, String(summary.totalTasks), {
		current: summary.totalTasks,
		previous: summary.prevTotalTasks,
	});
	updateCardValue(cards.rate, `${Math.round(summary.completedRate * 100)}%`, {
		current: summary.completedRate,
		previous: summary.prevCompletedRate,
		isRatio: true,
	});

	const timeDiff = summary.totalMinutes - summary.prevTotalMinutes;
	cards.time.valueEl.textContent = formatMinutes(summary.totalMinutes);
	updateChange(
		cards.time.changeEl,
		summary.prevTotalMinutes === 0
			? summary.totalMinutes > 0
				? "--"
				: ""
			: `${timeDiff >= 0 ? "+" : ""}${formatMinutes(timeDiff)}`,
		summary.prevTotalMinutes === 0 ? 0 : timeDiff,
	);
}

function updateCardValue(
	card: StatsCardElements,
	display: string,
	change: {
		current: number;
		previous: number;
		isRatio?: boolean;
	},
): void {
	card.valueEl.textContent = display;
	updateChange(card.changeEl, formatChange(change), getChangeValue(change));
}

function formatChange(change: {
	current: number;
	previous: number;
	isRatio?: boolean;
}): string {
	if (change.previous === 0) {
		return change.current > 0 ? "--" : "";
	}

	const value = getChangeValue(change);
	return `${value >= 0 ? "+" : ""}${value}%`;
}

function getChangeValue(change: {
	current: number;
	previous: number;
	isRatio?: boolean;
}): number {
	if (change.previous === 0) return 0;
	const diff = change.current - change.previous;
	return change.isRatio
		? Math.round(diff * 100)
		: Math.round((diff / change.previous) * 100);
}

function updateChange(el: HTMLElement, text: string, diff: number): void {
	el.textContent = text;
	el.toggleClass("is-positive", diff > 0);
	el.toggleClass("is-negative", diff < 0);
}

function formatMinutes(m: number): string {
	const abs = Math.abs(m);
	const h = Math.floor(abs / 60);
	const min = abs % 60;
	const prefix = m < 0 ? "-" : "";
	return `${prefix}${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
