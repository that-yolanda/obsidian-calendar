import en, { type TranslationKey } from "./en";
import zhCN from "./zh-cn";

const localeMap: Record<string, Partial<typeof en>> = {
	en,
	zh: zhCN,
	"zh-cn": zhCN,
	"zh-tw": zhCN,
};

function getLocale(): string {
	const stored = localStorage.getItem("language");
	if (stored) return stored;
	// biome-ignore lint/suspicious/noExplicitAny: moment is globally available in Obsidian
	return (window as any).moment?.locale() ?? "en";
}

export function t(key: TranslationKey, ...args: string[]): string {
	const dict = localeMap[getLocale()] ?? en;
	let text = dict[key] ?? en[key] ?? key;
	for (const [i, arg] of args.entries()) {
		text = text.replace(`%${i + 1}`, arg);
	}
	return text;
}
