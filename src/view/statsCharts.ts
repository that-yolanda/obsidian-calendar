import { BarChart, PieChart } from "echarts/charts";
import {
	GridComponent,
	LegendComponent,
	TitleComponent,
	TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { t } from "../i18n";
import type { PeriodSummary, StatsChartColors, StatsPeriod } from "../types";
import { TASK_STATUS_OPTIONS } from "../types";
import { formatMinutes } from "../utils/time";

echarts.use([
	PieChart,
	BarChart,
	TooltipComponent,
	LegendComponent,
	GridComponent,
	TitleComponent,
	SVGRenderer,
]);

type EChartsOption =
	ReturnType<typeof echarts.init> extends {
		setOption(opt: infer T): void;
	}
		? T
		: never;

export interface StatsChartTheme {
	isDarkMode: boolean;
	textColor: string;
	titleSize: number;
	borderColor: string;
}

function getStatusChartColor(
	status: (typeof TASK_STATUS_OPTIONS)[number],
	colors: StatsChartColors,
): string {
	return colors[status.value];
}

export function buildDonutOption(
	summary: PeriodSummary,
	colors: StatsChartColors,
	theme: StatsChartTheme,
): EChartsOption {
	const dist = summary.statusDistribution;

	return {
		darkMode: theme.isDarkMode,
		title: [
			{
				text: t("stats.taskCount"),
				textStyle: {
					color: theme.textColor,
					fontSize: theme.titleSize,
				},
			},
		],
		tooltip: [
			{
				trigger: "item",
				formatter: "{b}: {c} ({d}%)",
			},
		],
		legend: {
			bottom: 20,
			left: "center",
		},
		series: [
			{
				type: "pie",
				radius: ["20%", "50%"],
				avoidLabelOverlap: false,
				itemStyle: {
					borderRadius: 4,
				},
				label: {
					show: false,
				},
				emphasis: {
					label: {
						show: true,
					},
				},
				data: TASK_STATUS_OPTIONS.map((status) => ({
					value: dist[status.value],
					name: t(`status.${status.value}` as Parameters<typeof t>[0]),
					itemStyle: {
						color: getStatusChartColor(status, colors),
					},
				})),
			},
		],
	};
}

export function buildBarOption(
	summary: PeriodSummary,
	period: StatsPeriod,
	colors: StatsChartColors,
	theme: StatsChartTheme,
): EChartsOption {
	const dates = summary.dailyTimeSpent.map((d) => {
		const parts = d.date.split("-");
		return `${parts[1]}/${parts[2]}`;
	});
	const values = summary.dailyTimeSpent.map((d) => d.minutes);

	return {
		darkMode: theme.isDarkMode,
		title: [
			{
				text: t("stats.taskDuration"),
				textStyle: {
					color: theme.textColor,
					fontSize: theme.titleSize,
				},
			},
		],
		tooltip: {
			trigger: "axis",
			formatter(params: unknown) {
				const p = Array.isArray(params) ? params[0] : params;
				const data = p as {
					name: string;
					value: number;
				};
				return `${data.name}<br/>${t("stats.timeSpent")}: ${formatMinutes(data.value)}`;
			},
		},
		grid: {
			left: 50,
			right: 16,
			top: 64,
			bottom: 50,
		},
		xAxis: {
			type: "category",
			data: dates,
			axisLabel: {
				fontSize: 11,
				rotate: period === "month" ? 45 : 0,
			},
			axisTick: { show: false },
		},
		yAxis: {
			type: "value",
			axisLabel: {
				fontSize: 11,
				formatter(val: number): string {
					return formatMinutes(val, true);
				},
			},
		},
		series: [
			{
				type: "bar",
				data: values,
				barMaxWidth: 24,
				itemStyle: {
					color: colors.bar,
					borderRadius: [4, 4, 0, 0],
				},
			},
		],
	};
}
